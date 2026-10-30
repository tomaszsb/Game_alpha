# Round 2 style mock-ups: research notes and sources (2026-10-29)

Mock-ups only. Nothing here is in the game.

## Fonts
- OpenDyslexic, Wery & Diliberto 2017, Annals of Dyslexia (12 children, 9-12): no gain in reading rate or accuracy vs Arial / Times; no child preferred it. https://pmc.ncbi.nlm.nih.gov/articles/PMC5629233/
- Rello & Baeza-Yates 2013, "Good fonts for dyslexia" (48 readers with dyslexia, eye tracking, 12 fonts): OpenDyslexic neither better nor worse; readers preferred Verdana / Helvetica; italics hurt. https://en.wikipedia.org/wiki/OpenDyslexic , https://editingresearch.byu.edu/2020/05/28/which-fonts-are-best-for-dyslexia/
- Kuster et al. 2018, Annals of Dyslexia (Dyslexie font, 170 + 147 children): no faster or more accurate reading; no harm either; preference did not match performance. https://pmc.ncbi.nlm.nih.gov/articles/PMC5934461/ , https://dyslexiahelp.umich.edu/latest/does-dyslexie-font-help-dyslexic-readers/
- Edutopia summary of the evidence: https://www.edutopia.org/article/do-dyslexia-fonts-actually-work/
- British Dyslexia Association style guide (via secondary copies): plain sans fonts, 12-14pt (16-19px) or larger, letter spacing ~35% of letter width, line spacing 1.5, cream / soft pastel background rather than pure white, no italics. https://ako.ac.nz/assets/Knowledge-centre/ALNACC-Resources/Dyslexia-resources/230907-Dyslexia-Friendly-Style-Guide.pdf , https://www.smashingmagazine.com/2021/11/dyslexia-friendly-mode-website/
- Takeaway: OpenDyslexic as a reader's choice (a switch), not forced on everyone. Poppins for titles, numbers and short labels. No study found on Poppins with OpenDyslexic as a pair; checked by eye in the mock-ups (Poppins is geometric with round, mirror-like b/d/p/q; OpenDyslexic is wider and bottom-heavy, so it needs more room per line).

## TV readability and the remote
- Amazon Fire TV design guidelines: body text at least 14sp, about 28px at 1080p. https://developer.amazon.com/docs/fire-tv/design-and-user-experience-guidelines.html
- Smart-TV partner guidance: minimum text 3% of screen height (~32px at 1080p). https://developer.whaletv.com/partnerportal/fonts/index.jhtml
- Marvel design team on TV: 18px only for non-essential tags, body 24px+. https://marvelapp.com/blog/designing-for-television/
- Android TV: always have one focused item; show focus with colour, size (scale) or motion, one consistent focus style; D-pad up/down walks a list, select picks. https://developer.android.com/training/tv/get-started/navigation , https://developer.android.com/design/ui/tv/guides/styles/focus-system

## Cutaways and showing building systems
- Technical illustration has three ways to show insides: cutaway (skin removed), ghosted / phantom (outer parts see-through), exploded. https://diglib.eg.org/items/3b719354-fc89-42cb-ab51-d95552fd614c , https://support.ptc.com/help/creo/creoillustrate/en/creo_illustrate/gxy1195.html , https://khulsey.com/cutaway-illustrations.html
- BIM viewers highlight one system by picking it from a "systems browser" list (Autodesk APS viewer extension; Archibus shows the picked system in one colour and the rest in another). Found click, not hover; hover is our own step. https://aps.autodesk.com/blog/adding-systems-browser-viewer , https://help.archibus.com/user_en_v2022.02/Subsystems/webc/Content/web_user/bim_viewer/mechanical.htm
- No single industry colour code for trades; it is set per project with a legend on the first sheet (one print shop uses plumbing green, electrical red, fire protection orange). So: our own legend, and every system also gets an icon so colour is not the only clue. https://www.alphagraphics.com/us-arizona-phoenix-us011/blog/blog-list/2025/04/color-blueprints-how-a-splash-of-color-prevents-costly-mep-clashes , https://www.designingbuildings.co.uk/wiki/MEP_BIM_Coordination

## Looking different from other games
- Sameness mostly comes from cheap shared tools and asset packs, and chasing realism / the popular look; standing out comes from committing to one cohesive style that fits the game (limited palette, simple shapes, hand-made feel). https://www.wayline.io/blog/indie-game-visual-crisis , https://pixune.com/blog/art-styles-in-indie-games-vs-aaa-games/ , https://gamedeveloper.com/game-platforms/valve-s-francke-game-art-direction-in-its-infancy-
- Pictorial (bird's-eye) city maps: buildings drawn standing up on a flat plan so each keeps its face while the layout stays readable; a long US tradition. https://en.wikipedia.org/wiki/Pictorial_map
- Architects' card / massing models are a real-world look that belongs to this game's subject (used for version C).

## Separating who is talking (phone panel)
- Comics: speech balloons with a tail for a character; rectangular caption boxes for the narrator. https://en.wikipedia.org/wiki/Speech_balloon , https://teachers.yale.edu/curriculum/units/2025/3/1/2
- Messaging apps: a person's messages in bubbles with a face; system notes as small centred grey lines (used for version B).
- Story games: a dialogue box with a name tag under the character (used for version C).

## Game data used (not invented)
- Scope lines: CARDS_EXPANDED.csv work packages (W cards) + SCOPE_WORDING.csv templates, project type "apartment building": W078 Sidewalk Shed, W167 Structural, W029 Plumbing, W042 Mechanical Systems, W053 Sprinklers, W124 Elevator, W011 General Construction.
- NPC talk: SPACE_CONTENT.csv, CON-INSPECT (the Contractor) and REG-DOB-PLAN-EXAM.
- Growth stages: simplified from D:\Unravel\flipbook stages.jsx (21 stages, The Lot to Handover).
