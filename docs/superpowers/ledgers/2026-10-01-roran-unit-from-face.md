# SDD ledger — plan: docs/superpowers/plans/2026-10-01-roran-unit-from-face.md

Spec: docs/superpowers/specs/2026-10-01-roran-unit-from-face-design.md
Executor: native (executing-plans), chosen by user 2026-10-01

Pre-flight:
- T1→T2..: present.py (T1 Produces) used by T2-T5 with same CLI `present.py OUT GRID...` — consistent
- T2→T3→T4: down_base.txt chained — consistent
- T3/T4→T5: map letters added in T3/T4 must be copied into other bases (T5 Step 1 says so) — consistent
- T5→T6: propagate.py reads old frames from origin/main; T1 only changed `# map:` lines so rows equal main — consistent. new `# map:` taken from new base — consistent
- T6→T7: export.py writes roran-map.png only — consistent

Ruling: user checkpoints in the plan (show-and-stop at T1..T7) override the skill's continuous execution — user asked for them explicitly and memory says checkpoint instructions win — cost if wrong: extra waits.
Ruling: no unit tests in this plan (grids + git-ignored scratch tools; tools/ untouched). task-done test command = `pixel-asset-forge/.venv/bin/python pixel-asset-forge/tools/validate.py` for T1-T6, `npm test` for T7 — the plan's gates are validate/check_colors/visual — cost if wrong: a scratch-tool bug surfaces only visually.
Task 1: steps 1-6 done; validate 0; check_colors 24 ok 0 warnings; shown t1_colors.png; waiting for user before commit (step 7)
Task 1: complete (commits d620752..f7538c7, tests: pixel-asset-forge/.venv/bin/python pixel-asset-forge/tools/validate.py → 107 grid(s) ok)
Task 2: H1-H4 drawn via build_hair.py (window x10-22,y5-14); validate/check_colors ok 0 warnings; removed 1px stray bumps in H2(y8 x22)/H3(y9 x22) before showing; shown t2_hair.png + t2_hair_head.png; waiting for choice
Task 2: user chose H3 but asked bangs to flow right; interpreted as screen-right; drew hair_H3r (H3 with y9-11 reversed); shown t2_hair_r*.png; waiting
Task 2: Ruling: plan named options H1-H4; user chose H3 modified (bangs to screen-right) = H3r — user instruction — cost if wrong: redraw bangs y9-11
Task 2: complete (commits f7538c7..9f690bf, tests: pixel-asset-forge/.venv/bin/python pixel-asset-forge/tools/validate.py → 107 grid(s) ok)
Task 3: E1-E4 drawn via build_eyes.py (eyes y11-12 at x14/x17; map adds t=iris_slate u=iris_slate_dark v=eye_white when used); validate/check_colors ok 0 warnings; shown t3_eyes*.png; waiting
Task 3: complete (commits 9f690bf..7e71f5a, tests: pixel-asset-forge/.venv/bin/python pixel-asset-forge/tools/validate.py → 107 grid(s) ok)
Task 4: C1-C3 via build_cloth.py: all p->q, scarf y15 x12-19 d=skin_rose_deep, teal line per cand (C1 y16, C2 x15 front, C3 y23 hem). first try kept p rim -> broken dots, dropped before showing. validate/check_colors ok 0 warnings; shown t4_cloth*.png; waiting
Task 4: Ruling: dropped the p rim-light (all p->q) — leftover rim pixels read as broken dots — cost if wrong: arm/torso separation lost (told user)
Task 4: complete (commits 7e71f5a..c87ea7f, tests: pixel-asset-forge/.venv/bin/python pixel-asset-forge/tools/validate.py → 107 grid(s) ok)
Task 5: 3 bases via build_bases.py (from origin/main rows: p->q, notch, scarf, eye y12, side front line, left bangs strand); removed left bang pixel above eye (merged into 3px line) before showing; validate 107 ok, check_colors 24 ok 0 warnings; tops all y5; shown t5_*.png; waiting
Task 5: user feedback: top notch makes heart shape -> NG on side/back (front tolerated); back hair looked shaved -> extend to neck. drew build_backhair.py: up_B1-B3 (y12-14), left_back/right_back (notch removed, hair to y13-14). check ok 0 warnings; shown t5b_*.png; waiting
Task 5: user chose B2; asked front notch also removed; side back-hair got B2-style texture (finish_bases.py). validate 107 ok, check_colors 0 warnings; shown t5_heads/t5_bases; waiting
Task 5: user: side bangs look like helmet. drew build_sidebangs.py S1 (front hairline raised + diagonal lock edge), S2 (+rounded front-top corner), S3 (+flow streaks). check ok; shown t5c_left/right/bodies; waiting
Task 5: user chose S3 for sides, but left bangs should fall to eyes. drew build_leftbangs.py L1 (bangs over forehead, tips at y11 both sides of eye), L2 (+eye top hidden), L3 (L1 + 1px protrusion in front of face). shown t5d_*; waiting
Task 5: user: side hair over ear looks semi-long female; wants hair slightly over ear. build_ears.py: ear 2x2 skin on left_L1e/L3e/right_S3e. ear merges with cheek visually. shown t5e_*; waiting
Task 5: user gave reference (side-parted female, bangs in front of forehead). build_side_ref.py: left_F1 (bangs protrude 2px, to eye level), left_F2 (1px), right_F1 (1px, stop at y10). shown t5f_*; waiting
Task 5: user: right F1 near natural; fix sideburn look using ear ref. build_right_ear.py: right_E1 (tip to y12, ear x16 y12, jaw skin back to x16 at y13), right_E2 (tip to y13, ear 2 tall). left deferred by user. shown t5g_*; waiting
Task 5: user chose right_E1; left next. build_left_mirror.py: left_M0 (right_E1 head shape mirrored x13-22 -> x9-18, hair shading from S3; first try swapped e/g -> light on lower back, dropped), M1 (+lock tip in front of eye y11), M2 (+tip to y12). shown t5h_*; waiting
Task 5: user chose left M2. applied left_M2/right_E1 to assets (uncommitted). validate 107 ok, check 0 warnings, tops y5; shown t5_bases/t5_heads; waiting
Task 5: user asked right hair = mirror of left M2. build_right_from_left.py -> cand/right_R1 (shape mirrored, shading from E1). check ok; shown t5i_*; waiting
Task 5: user chose R1 for right; applied (uncommitted)
Task 5: Ruling: side heads drafted by mirroring the other side's head shape (left M2 from right E1, then right R1 from left M2), body/equipment untouched, hair shading re-taken from the target direction — spec/SPEC forbid mirror for unit because near/far equipment swaps; head shape has no equipment; user chose results after seeing them — cost if wrong: side heads symmetric where they should differ (user reviewed).
Task 5: Ruling: front head notch removed too (user suggestion) after Task 2 commit — cost if wrong: none (user asked).
Task 5: complete (commits c87ea7f..78caba9, tests: pixel-asset-forge/.venv/bin/python pixel-asset-forge/tools/validate.py → 107 grid(s) ok)
Task 6: dry-run clashes 13 (walk 0 = plan premise holds): down_atk_hit 9 (fist over torso, keep frame), up_atk_wind 1 (o both), right_atk_hit 3 (arm over front line, keep frame) — all resolved by keeping old frame; no manual edits needed.
Task 6: Ruling: propagate.py also maps kept old-frame 'p' (sleeve/arm highlight) to 'q' — same decision as bases (p only for teal line); plan only handled clashes — cost if wrong: arm/torso separation lost in attack frames (visible in right_atk_hit).
Task 6: validate 107 ok; check_colors 24 ok 0 warnings; sheet.py foot_y 30 all, off only atk_hit x4 + left/right atk_wind (as SPEC). shown roran_preview + t6_frames; waiting
Task 6: committed as-is; user asked to redesign atk_hit (front/back straight-down forward swing, back sword hidden, side sword further forward) in THIS branch, SPEC 45deg rule to be revised here (user: item task #4 is about input asset, not this rule)
Task 6: complete (commits 78caba9..01001bb, tests: pixel-asset-forge/.venv/bin/python pixel-asset-forge/tools/validate.py → 107 grid(s) ok)
Task 6: found & fixed open hair outlines in atk frames (base hair used sword outline): open_edges.py now 72 vs main 98 baseline (remaining are corner style present on main). commit.
Task 6: (correction) open_edges after fix = 67 (not 72)
Task 6b: front atk_hit A1 (blade y22-27 to feet), A2 (short foreshortened y22-24), A3 (fist at waist, blade y23-27). validate/check ok. shown t6b_down*.png; waiting
Task 6b: user chose A1 but fist X must stay at base X. drew A4 (fist x7-10, blade x8-9 straight down y22-27, tip y28). shown t6b_down2*; waiting
Task 6b: drew A4s1/s2/s3 (fist+sword shifted 1/2/3 px toward center, build_atk_down_shift.py). check ok. shown t6b_down3*; waiting
Task 6b: user chose A4s3; drew A4s3u1/u2/u3 (raised 1/2/3 rows, sleeve row skipped). check ok. shown t6b_down4*; waiting
Task 6b: user chose u1; drew u1t1/t2/t3 (blade tilted, tip +1/+2/+3 toward center, steps spread evenly (k*tip+3)//6; first try floor -> kinks near tip, fixed before showing). shown t6b_down5*; waiting
Task 6b: Ruling: user wants both u1 and t2 kept until game check; put u1 in assets now, keep cand/down_atk_hit_A4s3u1t2.txt; Task 7 will export both variants for comparison — cost if wrong: one swap later
Task 6b: back atk_hit B1 (sword+arm hidden; fixed shoulder ledge y16 and y17 notch before showing), B2 (elbow peeks x20-22 y17-19). shown t6b_up*; waiting
Task 6b: user chose B2 for back; applied to assets
Task 6b: side atk_hit S1 (45deg, fist same, tip x1/x30), S2 (2:1 slope, arm extended 2px, tip x1/x30). check ok. shown t6b_left_zoom/right_zoom/side; waiting
Task 6b: user wanted to diagnose side atk oddness (arm extension vs blade angle). wide_horizontal.py: 56px-wide scratch render, blade horizontal (11px) for now-arm and S2-arm, left/right. not in assets. shown t6b_wide.png; waiting
Task 6b: user: blade angle is part of oddness; flat reduces it; fist too far forward -> wide_closer.py k=0..3 fist/guard/blade moved toward body, blade flat (left: far hand, hidden behind shield; right: near hand drawn over shield). shown t6b_closer_left/right; waiting
Task 6b: user: k=3 most natural; asked +1..+5 more -> rendered k=3..8 (t6b_closer2_left/right). waiting
Task 6b: B/C candidates in 32px with fist k=3 (build_side_bc.py): B flat 6px; C45u/d 45deg ~8.5px; C27u/d 1row/2cols ~6.7px. guard stays vertical. check ok. shown t6b_bc_left/right/bodies; waiting
Task 6b: build_side_axis.py: C45ux/C27ux with pommel-fist-guard-blade on one axis, guard perpendicular, auto outline. right: guard moved adjacent to fist (first try had 1px outline gap). left: fist/grip hidden behind shield, guard kept 1 step out (adjacent would hide guard). shown t6b_axis_left/right/bodies; waiting
Task 6b: user caught left blade 1 shorter (my build derived blade length from free space to frame edge). Fixed: left C45ux = right C45ux sword positions mirrored (blade 7 rows both), shading re-assigned, guard adjacent to fist and hidden behind shield where overlapping. shown t6b_axis2*; waiting
Task 6b: user OK side C45ux both; applied left/right atk_hit to assets (front u1, back B2 already). 
Task 6b: Ruling: SPEC records front atk_hit as u1 (straight); t2 (tilted) kept as cand only, to compare in game at Task 7 — user asked to keep both — cost if wrong: SPEC line rewrite if t2 chosen.
Task 6b: committed (assets atk_hit 4 dirs + SPEC atk_hit rules). validate 107 ok, check 0 warnings, foot y30 all.
Task 6b: complete (commits 01001bb..975b078, tests: validate 107 ok, check_colors 0 warnings, sheet.py foot 30)
Task 7: export ok (only roran-map.png changed), npm test 776/776, build ok. CDP: game renders new sprite; burst shots cluttered (debug labels/ring). GIF via SendUserFile failed (session not on project thread). User: will check locally; asked push -> committed 69a4e3e (roran-map.png + candidates/roran t2 + README) and pushed feat/roran-unit-from-face. User also asked formal sheet->GIF tool with README (new request; design pending approval).
Task 7 (side): user-approved sheet_gif.py tool: TDD tests/test_sheet_gif.py 11 tests RED->GREEN (incl. GIF 10ms rounding fix), forge suite 162 OK; README 2.7, CLAUDE.md, UPSTREAM.md updated; committed, not pushed
Task 7: pushed 027c69b. Remaining: user checks game locally (u1 vs t2); then Step4 contact_sheet, Step5 SPEC color count, Step6 HANDOVER, final review.
Task 7: user chose u1 (front). Ruling: skipped Step 4 contact_sheet "浮いていないか" check — only roran exists in forge assets/unit, other units are game placeholders, so drift is certain and uninformative (user pointed out); deferred to issue #23 step 5 — cost if wrong: style drift found later.
Task 7: removed candidates/roran; SPEC color count 15-19; HANDOVER rewritten top; committed.
Task 7: complete (commits 975b078..558b747, tests: npm test →    Duration  14.83s (transform 1.61s, setup 0ms, collect 3.64s, tests 1.06s, environment 10ms, prepare 3.14s))
Final review: fresh reviewer (opus) — Critical 0, Important 0, Minor 6.
Final: Ruling: re-graded Minor#1 (SPEC 目視の手順 still says all atk_hit off; README already fixed) to Important — canon contradiction would hide a real front/back center drift — fixed by doc edit (no test applicable: prose), suite unchanged.
Final: minor (deferred): right_atk_hit arm and torso same color, separated only by outline (told user during Task 6; not listed in HANDOVER)
Final: minor (deferred): sheet_gif.cell_origin frame defaults to 0, wrong coords for direction>0 if omitted
Final: minor (deferred): test_sheet_gif leaves NamedTemporaryFile(delete=False) files in /tmp
Final: minor (deferred): test_sheet_gif does not check direction order or the 1x row
Final: minor (deferred): sheet_gif/sheet traceback on missing definition file (same as sheet.py)
Final: Ruling: ISSUES.md:72 "atk_hit ゲーム内で未確認" left as is — user checked in game locally (chose u1) but I have not verified what that line covers — cost if wrong: one stale issue line.
PR24: CodeRabbit 2 findings: plan-doc validate (correct, not changed: plan is a log; execution did run validate; canon pixel-asset-forge/CLAUDE.md already says so); test temp files fixed TDD RED(TypeError)->GREEN, forge suite 163 OK, pushed
PR24 round2: --fps nan/inf rejected (TDD RED 2 subtests -> GREEN); cell_origin frame required (RED TypeError test -> GREEN); direction-order test added (passed immediately: coverage gap only; CodeRabbit's suggested test omitted frame and would have compared wrong cells). forge suite 165 OK; pushed
PR24 round3: fps>200 -> 0ms rejected (TDD RED idle=201 -> GREEN), forge suite 166 OK, pushed
PR24 round4: tiny fps -> OverflowError, slow fps -> Pillow struct.error (found beyond CodeRabbit's finding); now accept only 10..655350ms frame time; TDD RED(1 fail,2 errors)->GREEN; forge suite 167 OK; pushed
