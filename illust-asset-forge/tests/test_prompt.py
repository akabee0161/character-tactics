import pytest

from artgen.config import Character, ConfigError, Style, Template
from artgen.prompt import Overrides, build_prompt, split_tags, tag_key


def make(*, use_items=False, appearance=("brown hair",), style_prompt=("masterpiece",),
         style_negative=(), template_negative=(), char_negative=()):
    style = Style("s", list(style_prompt), list(style_negative))
    template = Template(
        name="t", width=1024, height=1024, prompt=["portrait"], negative=list(template_negative),
        export_size=256, steps=28, guidance=5, use_items=use_items,
        inpaint_strength=None, inpaint_feather=None, inpaint_box=None,
    )
    character = Character(
        id="c", name="C", style="s", subject=["1boy"], appearance=list(appearance),
        outfit=["armor"], items=["shield"], negative=list(char_negative),
        default_expression="normal",
        expressions={"normal": ["serious"], "hurt": ["pain"]},
        inpaint_box=None,
    )
    return style, template, character


def test_split_tags_keeps_commas_inside_parens():
    assert split_tags("a, (b, c:1.1), d ,") == ["a", "(b, c:1.1)", "d"]


def test_split_tags_list_is_stripped_only():
    assert split_tags([" a ", "(b, c:1.1)"]) == ["a", "(b, c:1.1)"]


def test_split_tags_keeps_commas_inside_brackets():
    assert split_tags("[a, b], c") == ["[a, b]", "c"]


def test_tag_key_ignores_weight_and_parens():
    assert tag_key("(Thin_Eyebrows:1.15)") == "thin eyebrows"
    assert tag_key("((smile))") == "smile"
    assert tag_key("[sweat]") == "sweat"


def test_order():
    style, template, character = make()
    p = build_prompt(style, template, character)
    assert p.positive == "1boy, brown hair, armor, portrait, serious, masterpiece"


def test_items_only_when_template_uses_them():
    style, template, character = make(use_items=True)
    assert "armor, shield, portrait" in build_prompt(style, template, character).positive
    style, template, character = make(use_items=False)
    assert "shield" not in build_prompt(style, template, character).positive


def test_expression_replaces_default():
    style, template, character = make()
    p = build_prompt(style, template, character, expression="hurt")
    assert "pain" in p.positive
    assert "serious" not in p.positive


def test_overrides_extra_and_remove_by_key():
    style, template, character = make()
    o = Overrides.from_args(extra="scar on cheek", remove="(serious:1.2)")
    p = build_prompt(style, template, character, overrides=o)
    assert "scar on cheek" in p.positive
    assert "serious" not in p.positive


def test_overrides_extra_goes_before_style():
    style, template, character = make()
    o = Overrides.from_args(extra="scar on cheek")
    p = build_prompt(style, template, character, overrides=o)
    assert p.positive.endswith("serious, scar on cheek, masterpiece")


def test_remove_ignores_weight_in_character_tag():
    style, template, character = make(appearance=("(thin eyebrows:1.15)",))
    o = Overrides.from_args(remove="thin eyebrows")
    p = build_prompt(style, template, character, overrides=o)
    assert "eyebrows" not in p.positive


def test_weighted_tag_with_comma_survives_notebook_string():
    style, template, character = make(appearance=("(a, b:0.9)",))
    o = Overrides.from_args(extra="c, d", remove="(a, b:0.5)")
    p = build_prompt(style, template, character, overrides=o)
    assert "a, b" not in p.positive  # 設定側のタグが、重みを無視して消える
    assert ", c, d," in p.positive
    o = Overrides.from_args(extra="(a, b:1.1), c")
    assert o.extra == ["(a, b:1.1)", "c"]  # カンマで割れない


def test_extra_replaces_config_tag_with_new_weight():
    style, template, character = make(appearance=("stubble",))
    o = Overrides.from_args(extra="(stubble:1.3)")
    p = build_prompt(style, template, character, overrides=o)
    assert "(stubble:1.3)" in p.positive
    assert p.positive.count("stubble") == 1


def test_remove_does_not_remove_extra_of_same_tag():
    style, template, character = make(appearance=("stubble",))
    o = Overrides.from_args(extra="(stubble:1.3)", remove="stubble")
    assert "(stubble:1.3)" in build_prompt(style, template, character, overrides=o).positive


def test_extra_negative_replaces_config_negative_weight():
    style, template, character = make(style_negative=("blurry",))
    o = Overrides.from_args(extra_negative="(blurry:1.4)")
    assert build_prompt(style, template, character, overrides=o).negative == "(blurry:1.4)"


@pytest.mark.parametrize("bad", ["(scar:1.2, smile, brown hair", "a), b", "[x"])
def test_unbalanced_override_is_rejected(bad):
    with pytest.raises(ConfigError) as e:
        Overrides.from_args(extra=bad)
    assert "カッコ" in str(e.value)


def test_dedupe_by_key_keeps_first():
    style, template, character = make(appearance=("(brown hair:1.2)",), style_prompt=("brown hair",))
    p = build_prompt(style, template, character)
    assert p.positive.count("brown hair") == 1
    assert "(brown hair:1.2)" in p.positive


def test_negative_merge_and_remove():
    style, template, character = make(style_negative=("lowres",), template_negative=("full body",))
    o = Overrides.from_args(extra_negative="blurry", remove_negative="lowres")
    p = build_prompt(style, template, character, overrides=o)
    assert p.negative == "full body, blurry"


def test_negative_order_and_character_negative():
    style, template, character = make(
        style_negative=("lowres",), template_negative=("full body",), char_negative=("hat",)
    )
    assert build_prompt(style, template, character).negative == "lowres, full body, hat"


def test_unknown_expression():
    style, template, character = make()
    with pytest.raises(ConfigError) as e:
        build_prompt(style, template, character, expression="laugh")
    assert "normal" in str(e.value)


def test_overrides_to_dict_skips_empty():
    assert Overrides.from_args(extra="a").to_dict() == {"extra": ["a"]}
    assert Overrides().to_dict() == {}
    assert Overrides().is_empty()
    assert not Overrides.from_args(remove="a").is_empty()
