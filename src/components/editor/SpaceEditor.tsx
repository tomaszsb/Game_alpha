import React, { useEffect, useRef, useState } from 'react';
import { SpaceRow, DiceRollRow, ModalConfigRow, PHASES, PATH_TYPES, YES_NO_OPTIONS, YES_NO_LOWER_OPTIONS, SHAKE_OPTIONS, TTS_FIELD_OPTIONS } from './types/EditorTypes';
import { InlineDiceRollEditor } from './InlineDiceRollEditor';
import { shortName } from '../../utils/boardCommon';
import { SpaceRegionAnchor, regionHeading, regionShortLabel } from './spaceRegions';

/**
 * The safe subset a teacher may change: what a space SAYS and what it costs,
 * never where it leads. Mirrors EDITABLE_FIELDS in server/instanceCatalog.js,
 * which the catalog also ships as `editableFields` — the words a teacher can
 * rewrite for their own classroom, without being able to rewire the board.
 */
export const SAFE_FIELD_SUBSET = ['Title', 'Event', 'Action', 'Outcome', 'Time', 'Fee'];

interface SpaceEditorProps {
  spaceFirst: SpaceRow | null;
  spaceSubsequent: SpaceRow | null;
  visitType: 'First' | 'Subsequent';
  allSpaceNames: string[];
  diceRollData: DiceRollRow[];
  modalConfigData: ModalConfigRow[];
  onVisitTypeChange: (visitType: 'First' | 'Subsequent') => void;
  onFieldChange: (visitType: 'First' | 'Subsequent', field: keyof SpaceRow, value: string) => void;
  /** Current tile label override (GAME_CONFIG.display_label_override) — per-space, shared across visits. */
  displayLabelOverride: string;
  /** Update the per-space tile label; writes to both First + Subsequent rows. */
  onDisplayLabelChange: (value: string) => void;
  onUpdateDiceRoll: (index: number, field: keyof DiceRollRow, value: string) => void;
  onAddDiceRoll: (diceRoll: DiceRollRow) => void;
  onDeleteDiceRoll: (index: number) => void;
  onModalConfigChange: (updatedConfigs: ModalConfigRow[]) => void;
  /**
   * What the ORIGINAL of this space says, keyed by visit type — the handful of
   * fields the classroom catalog carries (SAFE_FIELD_SUBSET). Given it, a
   * field you have changed is marked and can be put back on its own. Leave it
   * out and nothing is marked.
   */
  original?: Record<string, Record<string, string>> | null;
  /**
   * When given, ONLY these fields are shown. Pass SAFE_FIELD_SUBSET for a
   * teacher; leave it out for the full set. Same component either way — the
   * difference is how much of it you can see, not which editor you get.
   */
  visibleFields?: string[] | null;
  /**
   * "Take me to the fields that make this bit." Someone clicked a part of the
   * player view; this names the spot in the editor to scroll to and put the
   * cursor in. The `nonce` is what makes clicking the same part twice work —
   * without it the second click looks identical to the first and nothing
   * happens. See spaceRegions.ts for where these anchors come from.
   */
  goTo?: { anchor: SpaceRegionAnchor; nonce: number } | null;
  /**
   * "Something here just changed." Reports the anchor of the field or pop-up
   * box that was typed in, so the player view can flash the part it feeds.
   * The mapping from anchor to part is spaceRegions.ts's job, not this
   * component's — this only says what was touched.
   */
  onEdited?: (anchor: SpaceRegionAnchor) => void;
}

// Card type colors matching theme.ts cardTypes. The WORDS are not here: each
// column names itself with regionShortLabel(`action-<type>`), so it says the
// same thing the player view says about the same action.
const CARD_COLORS: Record<string, { primary: string; bg: string; border: string; text: string; emoji: string }> = {
  W: { primary: '#6f42c1', bg: '#f3e5f5', border: '#6f42c1', text: '#4a148c', emoji: '🏗️' },
  B: { primary: '#007bff', bg: '#e3f2fd', border: '#007bff', text: '#0d47a1', emoji: '🏦' },
  I: { primary: '#28a745', bg: '#e8f5e9', border: '#28a745', text: '#1b5e20', emoji: '💰' },
  L: { primary: '#dc3545', bg: '#fce4ec', border: '#dc3545', text: '#b71c1c', emoji: '🎲' },
  E: { primary: '#ff9800', bg: '#fff3e0', border: '#ff9800', text: '#e65100', emoji: '⚡' },
};

/**
 * The flash on the field you land on after clicking the player view. Named
 * here so the scoped stylesheet and the effect that toggles it agree.
 */
const GO_TO_CLASS = 'space-editor-field--just-arrived';

// Fieldset border colors
const SECTION_COLORS = {
  identity: '#6c757d',
  story: '#4caf50',
  cards: '#6f42c1',
  costs: '#fd7e14',
  movement: '#007bff',
  dice: '#ff9800',
  buttons: '#868e96',
};

export function SpaceEditor({
  spaceFirst,
  spaceSubsequent,
  visitType,
  allSpaceNames,
  diceRollData,
  modalConfigData,
  onVisitTypeChange,
  onFieldChange,
  displayLabelOverride,
  onDisplayLabelChange,
  onUpdateDiceRoll,
  onAddDiceRoll,
  onDeleteDiceRoll,
  onModalConfigChange,
  original,
  visibleFields,
  goTo,
  onEdited,
}: SpaceEditorProps): JSX.Element {
  const currentSpace = visitType === 'First' ? spaceFirst : spaceSubsequent;
  const formRef = useRef<HTMLDivElement | null>(null);

  // Someone clicked a part of the player view. Find the spot they meant,
  // bring it on screen, open it if it is a folded-up pop-up box, and put the
  // cursor in the first thing they can type in.
  useEffect(() => {
    if (!goTo) return;
    const root = formRef.current;
    if (!root) return;
    const find = () => root.querySelector<HTMLElement>(`[data-editor-anchor="${goTo.anchor}"]`);
    const spot = find();
    if (!spot) return;
    // A field inside a folded-up SECTION is in the DOM but not on screen, so
    // scrolling to it would land on nothing. Open its section first — one
    // level up from the folded pop-up box below, same idea. Sections are never
    // nested, so the only toggle inside the fieldset is its own.
    spot
      .closest<HTMLElement>('[data-editor-section]')
      ?.querySelector<HTMLButtonElement>('[data-section-toggle][aria-expanded="false"]')
      ?.click();
    // A folded-up pop-up box has nothing to type in until it is opened, and
    // opening it swaps the element out — so everything after this re-finds it
    // rather than holding on to the one we started with.
    spot.querySelector<HTMLButtonElement>('[data-anchor-open="true"]')?.click();
    let lit: HTMLElement | null = null;
    const settle = window.setTimeout(() => {
      lit = find();
      if (!lit) return;
      // Scroll here rather than above: until the section and the pop-up box
      // are open the target has no height to centre on.
      lit.scrollIntoView({ block: 'center', behavior: 'smooth' });
      lit.classList.add(GO_TO_CLASS);
      // Something to TYPE IN first — a pop-up box that has just been unfolded
      // leads with its "collapse" button, and landing there would be useless.
      const typeable = lit.querySelector<HTMLElement>('input, textarea, select');
      (typeable ?? lit.querySelector<HTMLElement>('button'))?.focus({ preventScroll: true });
    }, 0);
    const fade = window.setTimeout(() => lit?.classList.remove(GO_TO_CLASS), 1800);
    return () => {
      window.clearTimeout(settle);
      window.clearTimeout(fade);
      lit?.classList.remove(GO_TO_CLASS);
    };
  }, [goTo]);

  const shows = (field: string): boolean => !visibleFields || visibleFields.includes(field);
  // What the original says for one field, or undefined when the original is
  // not to hand (nothing is marked then, rather than everything).
  const originalValue = (field: string): string | undefined => original?.[visitType]?.[field];

  // Modal config helpers for current space + visit type.
  // `diceValue` is optional and defaults to empty-string (generic row).
  // Phase 4: rows are keyed by (space, visit, action, dice_value).
  const getModalConfig = (effectAction: string, diceValue: string = ''): ModalConfigRow | undefined => {
    if (!currentSpace) return undefined;
    return modalConfigData.find(
      r =>
        r.space_name === currentSpace.space_name &&
        r.visit_type === visitType &&
        r.effect_action === effectAction &&
        (r.dice_value || '') === diceValue
    );
  };

  const setModalConfigField = (
    effectAction: string,
    field: keyof ModalConfigRow,
    value: string,
    diceValue: string = ''
  ) => {
    if (!currentSpace) return;
    onEdited?.(`modal:${effectAction}`);
    const idx = modalConfigData.findIndex(
      r =>
        r.space_name === currentSpace.space_name &&
        r.visit_type === visitType &&
        r.effect_action === effectAction &&
        (r.dice_value || '') === diceValue
    );
    if (idx >= 0) {
      const updated = [...modalConfigData];
      updated[idx] = { ...updated[idx], [field]: value };
      // Remove row if all custom fields are empty
      const row = updated[idx];
      if (!row.modal_title && !row.modal_description && !row.modal_button_label && !row.modal_summary) {
        updated.splice(idx, 1);
      }
      onModalConfigChange(updated);
    } else {
      // Create new row
      const newRow: ModalConfigRow = {
        space_name: currentSpace.space_name,
        visit_type: visitType,
        effect_action: effectAction,
        modal_title: '',
        modal_description: '',
        modal_button_label: '',
        modal_summary: '',
        dice_value: diceValue,
        [field]: value,
      };
      onModalConfigChange([...modalConfigData, newRow]);
    }
  };

  if (!currentSpace) {
    return (
      <div style={styles.placeholder}>
        <div style={{ fontSize: '36px', marginBottom: '8px' }}>📍</div>
        <div style={{ fontSize: '14px', color: '#495057' }}>Select a space to edit</div>
      </div>
    );
  }

  const handleChange = (field: keyof SpaceRow, value: string) => {
    onFieldChange(visitType, field, value);
    onEdited?.(`field:${String(field)}`);
  };

  // ── What a folded-up section says about itself on its one line. Folding is
  //    what stops this column being "very big and sparse" (maintainer,
  //    2026-08-23), but folding that hid whether a section had anything in it
  //    would only move the problem, so every closed section still reports its
  //    own contents.
  const filled = (...values: Array<string | undefined>): boolean =>
    values.some(v => (v || '').trim() !== '');
  const clip = (value: string | undefined, max = 48): string => {
    const text = (value || '').trim().replace(/\s+/g, ' ');
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  };
  const modalFilled = (effectAction: string, diceValue = ''): boolean => {
    const config = getModalConfig(effectAction, diceValue);
    return !!(config && (config.modal_title || config.modal_description
      || config.modal_button_label || config.modal_summary));
  };
  const actionsSet = ['W', 'B', 'I', 'L', 'E'].filter(
    t => filled(currentSpace[`${t.toLowerCase()}_card` as keyof SpaceRow] as string)
  );
  const diceModalsSet = ['', '1', '2', '3', '4', '5', '6'].filter(dv => modalFilled('dice', dv));

  return (
    <div style={styles.container}>
      {/* Header with space name, tile label, and visit type toggle.
          The inline input edits the TILE LABEL (display_label_override) — the
          name shown on the board tile and player panel. It's a per-space value
          shared across First/Subsequent. The per-visit story title moved into
          the Story section below so the two are no longer conflated
          (fb:24c3849c / fb:170b98e6 — users typed here expecting the tile to
          rename, but this box used to edit the per-visit story title). */}
      <div style={styles.header}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={styles.spaceName}>{currentSpace.space_name}</h3>
            {/* The board tile's name. Not in the safe subset — renaming a tile
                changes what everyone at the table is looking at, which is a
                different act from rewriting what a space says. */}
            {shows('display_label_override') && <input
              type="text"
              value={displayLabelOverride || ''}
              onChange={(e) => onDisplayLabelChange(e.target.value)}
              placeholder={`Tile label (blank = ${shortName(currentSpace.space_name)})`}
              title="Tile label shown on the board and player panel. Leave blank to auto-name from the space ID."
              style={styles.titleInline}
              data-testid="space-tile-label-input"
            />}
          </div>
        </div>
        <div style={styles.visitToggle}>
          <button
            onClick={() => onVisitTypeChange('First')}
            style={{
              ...styles.toggleButton,
              ...(visitType === 'First' ? styles.toggleButtonActive : {})
            }}
          >
            1st
          </button>
          <button
            onClick={() => onVisitTypeChange('Subsequent')}
            style={{
              ...styles.toggleButton,
              ...(visitType === 'Subsequent' ? styles.toggleButtonActive : {})
            }}
          >
            Sub
          </button>
        </div>
      </div>

      {/* "You just came from the player view" flash on the field you landed
          on — the same component-scoped <style> + toggled class pattern
          BoardCanvas uses for its chronicle highlight, rather than a second
          way of doing the same thing. */}
      <style>{`
        @keyframes space-editor-go-to-kf {
          0%, 100% { box-shadow: 0 0 0 0 rgba(124,58,237,0); }
          50% { box-shadow: 0 0 0 5px rgba(124,58,237,0.45); }
        }
        .${GO_TO_CLASS} {
          border-radius: 6px;
          animation: space-editor-go-to-kf 0.8s ease-in-out 2;
        }
        @media (prefers-reduced-motion: reduce) {
          .${GO_TO_CLASS} { animation: none; box-shadow: 0 0 0 4px rgba(124,58,237,0.5); }
        }
      `}</style>

      <div style={styles.formContainer} ref={formRef}>
        {/* How this space behaves. Wholly outside the safe subset: phase, the
            outcome roll and negotiation decide how a space BEHAVES, not what
            it says, so a teacher never sees this section at all. Folded by
            default — it is the part that changes least often, and ten sections
            all standing open was most of what made this column feel long. */}
        {shows('phase') && (
          <EditorSection
            heading="How this space behaves"
            color={SECTION_COLORS.identity}
            defaultOpen={false}
            summary={[
              currentSpace.phase,
              currentSpace.requires_dice_roll?.toLowerCase() === 'yes' ? 'outcome roll' : null,
              currentSpace.Negotiate === 'YES' ? 'can negotiate' : null,
            ].filter(Boolean).join(' · ')}
          >
            <div style={styles.fieldRow}>
              <Field label="Space Name" value={currentSpace.space_name} readOnly />
              <Field label="Visit Type" value={currentSpace.visit_type} readOnly />
              <SelectField
                label="Phase"
                value={currentSpace.phase}
                options={PHASES as unknown as string[]}
                onChange={(v) => handleChange('phase', v)}
              />
              <SelectField
                anchor="field:requires_dice_roll"
                label="Dice Roll?"
                value={currentSpace.requires_dice_roll}
                options={YES_NO_LOWER_OPTIONS as unknown as string[]}
                onChange={(v) => handleChange('requires_dice_roll', v)}
              />
              <Field
                anchor="field:rolls"
                label="Rolls"
                value={currentSpace.rolls}
                type="number"
                onChange={(v) => handleChange('rolls', v)}
              />
              <SelectField
                anchor="field:Negotiate"
                label="Negotiate"
                value={currentSpace.Negotiate}
                options={YES_NO_OPTIONS as unknown as string[]}
                onChange={(v) => handleChange('Negotiate', v)}
              />
            </div>
            {/* Moved out of the story section: how a line is announced and
                shaken is behaviour, not words a player reads. */}
            {shows('shake_on') && <div style={styles.fieldRow}>
              <SelectField
                label="Shake On"
                value={currentSpace.shake_on}
                options={[...SHAKE_OPTIONS].filter(o => o !== '')}
                onChange={(v) => handleChange('shake_on', v)}
              />
              <SelectField
                label="TTS Field"
                value={currentSpace.tts_field}
                options={[...TTS_FIELD_OPTIONS].filter(o => o !== '')}
                onChange={(v) => handleChange('tts_field', v)}
              />
              <div style={{ flex: 4 }} />
            </div>}
          </EditorSection>
        )}

        {/* From here down the sections run in the order the player view runs,
            each headed with the words the player view uses for the same part.
            The pop-ups come after, and the turn buttons stay LAST to mirror
            the in-game panel, where they sit at the bottom (fb:8f64c34c). */}

        <EditorSection
          heading={regionHeading('story')}
          color={SECTION_COLORS.story}
          defaultOpen
          summary={clip(currentSpace.Event) || 'nothing written'}
        >
          <TextareaField
            anchor="field:Title"
            label="Story title (subtitle, per visit)"
            value={currentSpace.Title}
            onChange={(v) => handleChange('Title', v)}
            original={originalValue('Title')}
            rows={1}
          />
          <TextareaField
            anchor="field:Event"
            label="Event (Story)"
            value={currentSpace.Event}
            onChange={(v) => handleChange('Event', v)}
            original={originalValue('Event')}
            rows={2}
          />
        </EditorSection>

        {/* Split out of the old "Story & Narrative", so that each section
            answers to exactly one clickable part of the player view rather
            than two. */}
        <EditorSection
          heading={regionHeading('guidance')}
          color={SECTION_COLORS.story}
          defaultOpen
          summary={clip(currentSpace.Action) || 'nothing written'}
        >
          <TextareaField
            anchor="field:Action"
            label="Action"
            value={currentSpace.Action}
            onChange={(v) => handleChange('Action', v)}
            original={originalValue('Action')}
            rows={2}
          />
          <TextareaField
            anchor="field:Outcome"
            label="Outcome"
            value={currentSpace.Outcome}
            onChange={(v) => handleChange('Outcome', v)}
            original={originalValue('Outcome')}
            rows={2}
          />
        </EditorSection>

        {/* Its own section now. It was the tail of the old "(C) Actions"
            fieldset, which meant a teacher — who may change what a space costs
            but not what it deals — met a fieldset renamed around them. */}
        <EditorSection
          heading={regionHeading('cost')}
          color={SECTION_COLORS.costs}
          defaultOpen={filled(currentSpace.Time, currentSpace.Fee)}
          summary={[currentSpace.Time, currentSpace.Fee].filter(v => (v || '').trim() !== '').join(' · ') || 'nothing'}
        >
          <div style={styles.fieldRow}>
            <div style={styles.field} data-editor-anchor="field:Time">
              <LabelWithRevert
                label="⏱️ Time"
                value={currentSpace.Time}
                original={originalValue('Time')}
                onChange={(v) => handleChange('Time', v)}
              />
              <TimeInput value={currentSpace.Time} onChange={(v) => handleChange('Time', v)} />
              {shows('w_card') && currentSpace.Time && <ModalConfigExpander effectAction="add" getModalConfig={getModalConfig} setModalConfigField={setModalConfigField} />}
            </div>
            <div style={styles.field} data-editor-anchor="field:Fee">
              <LabelWithRevert
                label="💰 Fee"
                value={currentSpace.Fee}
                original={originalValue('Fee')}
                onChange={(v) => handleChange('Fee', v)}
              />
              <FeeInput value={currentSpace.Fee} onChange={(v) => handleChange('Fee', v)} />
              {shows('w_card') && currentSpace.Fee && <ModalConfigExpander effectAction="deduct" getModalConfig={getModalConfig} setModalConfigField={setModalConfigField} />}
            </div>
            <div style={{ flex: 1 }} />
          </div>
        </EditorSection>

        {/* The five actions. Outside the safe subset: what a space DEALS is
            not what it SAYS. Each column names itself with the same words the
            player view uses for that action. */}
        {shows('w_card') && (
          <EditorSection
            heading="The actions players can take"
            color={SECTION_COLORS.cards}
            defaultOpen={actionsSet.length > 0}
            summary={actionsSet.length
              ? actionsSet.map(t => regionShortLabel(`action-${t}`)).join(' · ')
              : 'none'}
          >
            <div style={styles.cardGrid}>
              <CardFieldWithLabel type="W" value={currentSpace.w_card} label={currentSpace.w_card_label} narrative={currentSpace.w_card_narrative}
                modalConfig={getModalConfig('draw_W')}
                onChange={(v) => handleChange('w_card', v)} onLabelChange={(v) => handleChange('w_card_label', v)} onNarrativeChange={(v) => handleChange('w_card_narrative', v)}
                onModalConfigChange={(f, v) => setModalConfigField('draw_W', f, v)} />
              <CardFieldWithLabel type="B" value={currentSpace.b_card} label={currentSpace.b_card_label} narrative={currentSpace.b_card_narrative}
                modalConfig={getModalConfig('draw_B')}
                onChange={(v) => handleChange('b_card', v)} onLabelChange={(v) => handleChange('b_card_label', v)} onNarrativeChange={(v) => handleChange('b_card_narrative', v)}
                onModalConfigChange={(f, v) => setModalConfigField('draw_B', f, v)} />
              <CardFieldWithLabel type="I" value={currentSpace.i_card} label={currentSpace.i_card_label} narrative={currentSpace.i_card_narrative}
                modalConfig={getModalConfig('draw_I')}
                onChange={(v) => handleChange('i_card', v)} onLabelChange={(v) => handleChange('i_card_label', v)} onNarrativeChange={(v) => handleChange('i_card_narrative', v)}
                onModalConfigChange={(f, v) => setModalConfigField('draw_I', f, v)} />
              <CardFieldWithLabel type="L" value={currentSpace.l_card} label={currentSpace.l_card_label} narrative={currentSpace.l_card_narrative}
                modalConfig={getModalConfig('draw_L')}
                onChange={(v) => handleChange('l_card', v)} onLabelChange={(v) => handleChange('l_card_label', v)} onNarrativeChange={(v) => handleChange('l_card_narrative', v)}
                onModalConfigChange={(f, v) => setModalConfigField('draw_L', f, v)} />
              <CardFieldWithLabel type="E" value={currentSpace.e_card} label={currentSpace.e_card_label} narrative={currentSpace.e_card_narrative}
                modalConfig={getModalConfig('draw_E')}
                onChange={(v) => handleChange('e_card', v)} onLabelChange={(v) => handleChange('e_card_label', v)} onNarrativeChange={(v) => handleChange('e_card_narrative', v)}
                onModalConfigChange={(f, v) => setModalConfigField('draw_E', f, v)} />
            </div>
          </EditorSection>
        )}

        {/* Outside the safe subset: the outcome table decides where a player
            goes next. `section:outcomes` is the whole fieldset because these
            fields have no single spot of their own. */}
        {shows('w_card') && currentSpace.requires_dice_roll?.toLowerCase() === 'yes' && (
          <EditorSection
            heading={regionHeading('outcomes')}
            color={SECTION_COLORS.dice}
            defaultOpen
            anchor="section:outcomes"
            summary={`${diceRollData.length} written`}
          >
            <InlineDiceRollEditor
              diceRolls={diceRollData}
              spaceName={currentSpace.space_name}
              visitType={visitType}
              allSpaceNames={allSpaceNames}
              onUpdateDiceRoll={onUpdateDiceRoll}
              onAddDiceRoll={onAddDiceRoll}
              onDeleteDiceRoll={onDeleteDiceRoll}
            />
          </EditorSection>
        )}

        {/* The reason the safe subset exists: rewriting words must not be able
            to rewire where the board leads. */}
        {shows('space_1') && (
          <EditorSection
            heading={regionHeading('destinations')}
            color={SECTION_COLORS.movement}
            defaultOpen={filled(currentSpace.space_1)}
            summary={currentSpace.path === 'LOGIC'
              ? 'decided by a rule'
              : [currentSpace.space_1, currentSpace.space_2, currentSpace.space_3, currentSpace.space_4, currentSpace.space_5]
                  .filter(v => (v || '').trim() !== '').map(v => shortName(v)).join(' · ') || 'nowhere'}
          >
            <div style={{ ...styles.fieldRow, marginBottom: '6px' }}>
              <SelectField
                anchor="field:path"
                label="Path Type"
                value={currentSpace.path}
                options={PATH_TYPES as unknown as string[]}
                onChange={(v) => handleChange('path', v)}
              />
              <div style={{ flex: 3 }} />
            </div>
            {currentSpace.path === 'LOGIC' ? (
              <LogicBuilder
                currentSpace={currentSpace}
                allSpaceNames={allSpaceNames}
                onFieldChange={handleChange}
              />
            ) : (
              <div style={styles.fieldRow}>
                <SpaceSelectField anchor="field:space_1" label="1" value={currentSpace.space_1} options={allSpaceNames} onChange={(v) => handleChange('space_1', v)} />
                <SpaceSelectField anchor="field:space_2" label="2" value={currentSpace.space_2} options={allSpaceNames} onChange={(v) => handleChange('space_2', v)} />
                <SpaceSelectField anchor="field:space_3" label="3" value={currentSpace.space_3} options={allSpaceNames} onChange={(v) => handleChange('space_3', v)} />
                <SpaceSelectField anchor="field:space_4" label="4" value={currentSpace.space_4} options={allSpaceNames} onChange={(v) => handleChange('space_4', v)} />
                <SpaceSelectField anchor="field:space_5" label="5" value={currentSpace.space_5} options={allSpaceNames} onChange={(v) => handleChange('space_5', v)} />
              </div>
            )}
          </EditorSection>
        )}

        {/* The pop-ups, gathered under one heading so the eye can skip the
            lot. They are wording that lands ON the panel rather than part of
            it, which is why they sit below everything the panel itself shows. */}
        {shows('w_card') && <div style={styles.groupDivider}>Pop-ups that land on top of the panel</div>}

        {/* Per-dice-value overrides for DiceResultModal. Each roll (1..6) can
            have its own wording; the "Any Roll" slot applies when no
            dice-specific row matches. */}
        {shows('w_card') && currentSpace.requires_dice_roll?.toLowerCase() === 'yes' && (
          <EditorSection
            heading={regionHeading('popup-outcome')}
            color={SECTION_COLORS.dice}
            defaultOpen={diceModalsSet.length > 0}
            summary={diceModalsSet.length ? `${diceModalsSet.length} written` : 'nothing written'}
          >
            <div style={styles.sectionHint}>
              Dice-specific rows win over “Any Roll”. Supports <code>{'{diceValue}'}</code> and{' '}
              <code>{'{spaceName}'}</code>.
            </div>
            <div style={{ marginBottom: '4px' }}>
              <ModalConfigExpander
                effectAction="dice"
                diceValue=""
                label="Any Roll"
                getModalConfig={getModalConfig}
                setModalConfigField={setModalConfigField}
              />
            </div>
            {['1', '2', '3', '4', '5', '6'].map(value => (
              <div key={value} style={{ marginBottom: '4px' }}>
                <ModalConfigExpander
                  effectAction="dice"
                  diceValue={value}
                  label={`Roll ${value}`}
                  getModalConfig={getModalConfig}
                  setModalConfigField={setModalConfigField}
                />
              </div>
            ))}
          </EditorSection>
        )}

        {/* Space-level overrides for any non-movement, non-card choice modal
            (e.g. card-triggered CHOICE_OF_EFFECTS prompts). */}
        {shows('w_card') && (
          <EditorSection
            heading={regionHeading('popup-choice')}
            color="#6f42c1"
            defaultOpen={modalFilled('choice')}
            summary={modalFilled('choice') ? 'written' : 'nothing written'}
          >
            <div style={styles.sectionHint}>
              Overrides the generic “Make Your Choice” modal when a choice is raised at this space.
              Supports <code>{'{playerName}'}</code> and <code>{'{spaceName}'}</code>.
            </div>
            <ModalConfigExpander effectAction="choice" getModalConfig={getModalConfig} setModalConfigField={setModalConfigField} />
          </EditorSection>
        )}

        {/* Space-level overrides for the player-to-player negotiation flow.
            Applied when the current player's space matches. */}
        {shows('w_card') && (
          <EditorSection
            heading={regionHeading('popup-negotiate')}
            color="#e83e8c"
            defaultOpen={modalFilled('negotiate')}
            summary={modalFilled('negotiate') ? 'written' : 'nothing written'}
          >
            <div style={styles.sectionHint}>
              Overrides the player-to-player negotiation modal when opened from this space.
              Title replaces the step header, description replaces the “Select a player…” prompt,
              and button label replaces “Make Offer”. Supports <code>{'{playerName}'}</code>,{' '}
              <code>{'{partnerName}'}</code>, and <code>{'{spaceName}'}</code>.
            </div>
            <ModalConfigExpander effectAction="negotiate" getModalConfig={getModalConfig} setModalConfigField={setModalConfigField} />
          </EditorSection>
        )}

        {/* Overrides the victory modal when the game ends with the winner on
            this space. Only meaningful on FINISH/ending spaces. */}
        {shows('w_card') && (
          <EditorSection
            heading={regionHeading('popup-end-game')}
            color="#ffc107"
            defaultOpen={modalFilled('end_game')}
            summary={modalFilled('end_game') ? 'written' : 'nothing written'}
          >
            <div style={styles.sectionHint}>
              Overrides the victory modal when the winning player ends the game on this space.
              Title replaces “Game Complete!”, description replaces the victory subtitle,
              summary replaces the “Well played!” banner, button label replaces “Play Again”.
              Only applies to FINISH/ending spaces. Supports <code>{'{winnerName}'}</code>{' '}
              and <code>{'{spaceName}'}</code>.
            </div>
            <ModalConfigExpander effectAction="end_game" getModalConfig={getModalConfig} setModalConfigField={setModalConfigField} />
          </EditorSection>
        )}

        {/* Kept LAST to mirror the in-game panel, where the End Turn / Try
            Again buttons sit at the bottom (fb:8f64c34c). One section for
            both, because on the panel they are one row. */}
        {shows('end_turn_label') && (
          <EditorSection
            heading="The buttons that end the turn"
            color={SECTION_COLORS.buttons}
            defaultOpen={filled(currentSpace.end_turn_label, currentSpace.try_again_label)}
            summary={[
              currentSpace.end_turn_label || 'End Turn',
              currentSpace.Negotiate === 'YES' ? (currentSpace.try_again_label || 'Try Again') : null,
            ].filter(Boolean).join(' · ')}
          >
            <div style={styles.fieldRow}>
              <Field
                anchor="field:end_turn_label"
                label="End Turn Label"
                value={currentSpace.end_turn_label}
                onChange={(v) => handleChange('end_turn_label', v)}
                placeholder="End Turn"
              />
              <Field
                anchor="field:try_again_label"
                label="Try Again Label"
                value={currentSpace.try_again_label}
                onChange={(v) => handleChange('try_again_label', v)}
                placeholder="Try Again"
              />
              <div style={styles.field}>
                <label style={styles.label}>Preview</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <span style={styles.btnPreviewGreen}>{currentSpace.end_turn_label || 'End Turn'}</span>
                  {currentSpace.Negotiate === 'YES' && (
                    <span style={styles.btnPreviewYellow}>{currentSpace.try_again_label || 'Try Again'}</span>
                  )}
                </div>
              </div>
            </div>
          </EditorSection>
        )}
      </div>
    </div>
  );
}

// ─── Sections ──────────────────────────────────────────────

/**
 * One folding section of the editor, headed with the SAME words the player
 * view uses for the part it feeds.
 *
 * Two complaints made this, both from the maintainer on 2026-08-23 looking at
 * the merged screen for real: the left column was "very big and sparse", and
 * "it is hard to find things on the left that match things on the right".
 *
 * They had one cause. The editor named its sections after the data model —
 * "🃏 (C) Actions", "🎲 Dice Outcome Modals", "🚶 Movement Destinations" —
 * while the player view named the very same things in plain words: "The scope
 * worktypes action", "The pop-up after an outcome", "Where they go next".
 * Ten sections' worth of headings, and not one shared word between the two
 * halves of the screen. Headings now come from `spaceRegions.ts`, the one map
 * both sides already read, so the vocabularies cannot drift apart again.
 *
 * The sparseness was the other half: ten fieldsets standing open at once, most
 * of them empty on any given space. A section that has nothing written in it
 * now sits folded on one line — but a folded section still says what is inside
 * it, so folding hides bulk rather than information.
 *
 * The children stay MOUNTED while folded, hidden rather than unrendered. The
 * click-a-part-of-the-player-view jump finds its target with a DOM query, and
 * unmounting the fold would leave it nothing to find.
 */
function EditorSection({ heading, summary, color, defaultOpen, anchor, children }: {
  heading: string;
  /** What this section holds, for the one line it shows while folded. */
  summary?: string;
  color: string;
  defaultOpen: boolean;
  /** Set when the whole fieldset is the anchor (only `section:outcomes`). */
  anchor?: string;
  children: React.ReactNode;
}): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <fieldset
      data-editor-section=""
      data-editor-anchor={anchor}
      style={{
        ...styles.fieldset,
        borderLeft: `3px solid ${color}`,
        padding: open ? '6px 10px' : '0 10px 2px',
      }}
    >
      <legend style={styles.legend}>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          data-section-toggle=""
          style={styles.sectionHeaderBtn}
        >
          <span style={styles.sectionChevron} aria-hidden="true">{open ? '▾' : '▸'}</span>
          <span style={styles.sectionHeading}>{heading}</span>
          {!open && summary && <span style={styles.sectionSummary}>{summary}</span>}
        </button>
      </legend>
      <div hidden={!open} style={{ display: open ? 'block' : 'none' }}>{children}</div>
    </fieldset>
  );
}

// ─── Field Components ──────────────────────────────────────

/**
 * "You changed this — put it back."
 *
 * Carried over from the small editor that was removed: it marked every field
 * that no longer said what the original said, and let you undo that one field
 * on its own. Worth keeping, so it moved here rather than dying with it.
 *
 * Only appears for the fields the classroom catalog carries the original of;
 * everywhere else there is nothing to compare against and nothing is shown.
 */
function ChangedFromOriginal({ original, onRevert }: { original: string; onRevert: () => void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onRevert}
      title={original ? `The original says: ${original}` : 'The original leaves this empty'}
      style={{
        fontSize: '10px', color: '#7c3aed', background: 'none', border: 'none',
        cursor: 'pointer', textDecoration: 'underline', padding: 0, marginLeft: '6px',
      }}
    >
      changed — put back
    </button>
  );
}

/**
 * A label with the "changed — put back" marker beside it.
 *
 * Beside, not inside: a <button> is a labelable element, so a marker nested in
 * the <label> would take the label's words as its own accessible name and the
 * field itself would be left unlabelled.
 */
function LabelWithRevert({ label, value, original, onChange }: {
  label: React.ReactNode; value: string; original?: string; onChange: (v: string) => void;
}): JSX.Element {
  const differs = original !== undefined && (value || '') !== original;
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
      <label style={styles.label}>{label}</label>
      {differs && <ChangedFromOriginal original={original} onRevert={() => onChange(original)} />}
    </div>
  );
}

/** Highlight for a field that no longer says what the original says. */
const CHANGED_INPUT: React.CSSProperties = {
  border: '2px solid #7c3aed',
  backgroundColor: '#faf5ff',
};

interface FieldProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  type?: string;
  placeholder?: string;
  /** Where a click on the player view lands. See spaceRegions.ts. */
  anchor?: string;
}

function Field({ label, value, onChange, readOnly, type = 'text', placeholder, anchor }: FieldProps): JSX.Element {
  return (
    <div style={styles.field} data-editor-anchor={anchor}>
      <label style={styles.label}>{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        placeholder={placeholder}
        style={{
          ...styles.input,
          ...(readOnly ? styles.inputReadOnly : {})
        }}
      />
    </div>
  );
}

const CARD_PRESETS = ['Draw 1', 'Draw 2', 'Draw 3', 'Remove 1', 'Replace 1', 'No change'];

function CardFieldWithLabel({ type, value, label, narrative, modalConfig, onChange, onLabelChange, onNarrativeChange, onModalConfigChange }: {
  type: string; value: string; label: string; narrative?: string;
  modalConfig?: ModalConfigRow;
  onChange: (v: string) => void; onLabelChange: (v: string) => void; onNarrativeChange?: (v: string) => void;
  onModalConfigChange?: (field: keyof ModalConfigRow, value: string) => void;
}): JSX.Element {
  const [showNarrative, setShowNarrative] = useState(!!narrative);
  const hasModalConfig = modalConfig && (modalConfig.modal_title || modalConfig.modal_description || modalConfig.modal_button_label || modalConfig.modal_summary);
  const [showModalConfig, setShowModalConfig] = useState(!!hasModalConfig);
  const cc = CARD_COLORS[type];
  const cardTokens = getModalConfigTokens(`draw_${type}`);
  const isPreset = !value || CARD_PRESETS.includes(value);
  const [useCustom, setUseCustom] = useState(!isPreset && !!value);
  // Anchors so a click on this action in the player view lands here. Derived
  // from the type rather than passed in, so there is nothing to keep in step.
  const lower = type.toLowerCase();

  return (
    <div style={styles.cardWithLabel} data-editor-anchor={`field:${lower}_card`}>
      <label style={{ ...styles.label, color: cc.text, display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
        <span style={{ ...styles.cardBadge, backgroundColor: cc.bg, borderColor: cc.border, color: cc.primary, flexShrink: 0 }}>
          {cc.emoji} {type}
        </span>
        {/* The same words the player view uses for this action. A bare "🏗️ W"
            was most of why the two sides were hard to line up by eye. */}
        <span style={styles.cardColumnName}>{regionShortLabel(`action-${type}`)}</span>
      </label>
      <div style={{ display: 'flex', gap: '3px' }}>
        {useCustom ? (
          <div style={{ ...styles.comboRow, flex: 1 }}>
            <input
              type="text"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Custom..."
              style={{
                ...styles.input,
                flex: 1,
                backgroundColor: value ? cc.bg : undefined,
                borderColor: value ? cc.border + '60' : undefined,
              }}
            />
            <button
              onClick={() => { setUseCustom(false); if (!CARD_PRESETS.includes(value)) onChange(''); }}
              style={styles.comboToggle}
              title="Switch to dropdown"
            >▼</button>
          </div>
        ) : (
          <select
            value={value || ''}
            onChange={(e) => {
              if (e.target.value === '__custom__') setUseCustom(true);
              else onChange(e.target.value);
            }}
            style={{
              ...styles.select,
              flex: 1,
              backgroundColor: value ? cc.bg : undefined,
              borderColor: value ? cc.border + '60' : undefined,
            }}
          >
            <option value="">--</option>
            {CARD_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
            <option value="__custom__">Custom...</option>
          </select>
        )}
        <span style={{ flex: 1, display: 'flex' }} data-editor-anchor={`field:${lower}_card_label`}>
          <input
            type="text"
            value={label || ''}
            onChange={(e) => onLabelChange(e.target.value)}
            placeholder="Button label..."
            disabled={!value}
            style={{
              ...styles.input,
              flex: 1,
              fontSize: '11px',
              opacity: value ? 1 : 0.4,
            }}
          />
        </span>
      </div>
      {value && onNarrativeChange && (
        <div style={{ marginTop: '2px' }} data-editor-anchor={`field:${lower}_card_narrative`}>
          {showNarrative ? (
            <textarea
              value={narrative || ''}
              onChange={(e) => onNarrativeChange(e.target.value)}
              placeholder="Per-action narrative (shown in modal)..."
              rows={2}
              style={{
                ...styles.input,
                width: '100%',
                fontSize: '11px',
                fontStyle: 'italic',
                resize: 'vertical',
              }}
            />
          ) : (
            <button
              onClick={() => setShowNarrative(true)}
              data-anchor-open="true"
              style={{ fontSize: '10px', color: '#666', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}
            >+ narrative</button>
          )}
        </div>
      )}
      {value && onModalConfigChange && (
        <div style={{ marginTop: '2px' }} data-editor-anchor={`modal:draw_${type}`}>
          {showModalConfig ? (
            <div style={styles.modalConfigBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, color: '#495057' }}>Modal Overrides</span>
                <button onClick={() => setShowModalConfig(false)} style={{ fontSize: '9px', color: '#868e96', background: 'none', border: 'none', cursor: 'pointer' }}>collapse</button>
              </div>
              <div style={{ fontSize: '9px', color: '#868e96', marginBottom: '3px', fontStyle: 'italic' }}>
                Tokens: {cardTokens}
              </div>
              <input type="text" value={modalConfig?.modal_title || ''} onChange={(e) => onModalConfigChange('modal_title', e.target.value)}
                placeholder="Modal title..." style={{ ...styles.input, fontSize: '11px', marginBottom: '2px', width: '100%' }} />
              <input type="text" value={modalConfig?.modal_description || ''} onChange={(e) => onModalConfigChange('modal_description', e.target.value)}
                placeholder={`Description (${cardTokens})...`} style={{ ...styles.input, fontSize: '11px', marginBottom: '2px', width: '100%' }} />
              <input type="text" value={modalConfig?.modal_button_label || ''} onChange={(e) => onModalConfigChange('modal_button_label', e.target.value)}
                placeholder="Button label..." style={{ ...styles.input, fontSize: '11px', marginBottom: '2px', width: '100%' }} />
              <input type="text" value={modalConfig?.modal_summary || ''} onChange={(e) => onModalConfigChange('modal_summary', e.target.value)}
                placeholder="Summary text..." style={{ ...styles.input, fontSize: '11px', width: '100%' }} />
            </div>
          ) : (
            <button
              onClick={() => setShowModalConfig(true)}
              data-anchor-open="true"
              style={{ fontSize: '10px', color: hasModalConfig ? cc.primary : '#666', fontWeight: hasModalConfig ? 600 : 400, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}
            >{hasModalConfig ? '✎ modal config' : '+ modal config'}</button>
          )}
        </div>
      )}
    </div>
  );
}

function SelectField({ label, value, options, onChange, anchor }: { label: string; value: string; options: string[]; onChange: (v: string) => void; anchor?: string }): JSX.Element {
  return (
    <div style={styles.field} data-editor-anchor={anchor}>
      <label style={styles.label}>{label}</label>
      <select value={value || ''} onChange={(e) => onChange(e.target.value)} style={styles.select}>
        <option value="">--</option>
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
}

function SpaceSelectField({ label, value, options, onChange, anchor }: { label: string; value: string; options: string[]; onChange: (v: string) => void; anchor?: string }): JSX.Element {
  const isComplex = value && !options.includes(value) && value.length > 0;
  return (
    <div style={styles.field} data-editor-anchor={anchor}>
      <label style={styles.label}>{label}</label>
      {isComplex ? (
        <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} style={styles.input} title="Complex value" />
      ) : (
        <select value={value || ''} onChange={(e) => onChange(e.target.value)} style={styles.select}>
          <option value="">--</option>
          {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      )}
    </div>
  );
}

function TextareaField({ label, value, onChange, rows = 2, original, anchor }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number;
  /** What the original says, when it is known. Undefined = nothing to compare. */
  original?: string;
  /** Where a click on the player view lands. See spaceRegions.ts. */
  anchor?: string;
}): JSX.Element {
  const differs = original !== undefined && (value || '') !== original;
  return (
    <div style={styles.textareaField} data-editor-anchor={anchor}>
      <LabelWithRevert label={label} value={value} original={original} onChange={onChange} />
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={differs ? { ...styles.textarea, ...CHANGED_INPUT } : styles.textarea}
        rows={rows}
      />
    </div>
  );
}

// Time inline input
function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }): JSX.Element {
  const timeMatch = value?.match(/^(\d+)\s*days?$/i);
  const isNumeric = !value || timeMatch;
  if (!isNumeric) {
    return <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} style={styles.input} />;
  }
  const numDays = timeMatch ? parseInt(timeMatch[1]) : 0;
  return (
    <div style={styles.helperRow}>
      <input
        type="number" min="0" value={numDays || ''}
        onChange={(e) => {
          const n = parseInt(e.target.value);
          onChange(!e.target.value || n <= 0 ? '' : `${n} ${n === 1 ? 'day' : 'days'}`);
        }}
        style={{ ...styles.input, flex: 1 }} placeholder="0"
      />
      <span style={styles.helperSuffix}>days</span>
    </div>
  );
}

// Fee inline input
function FeeInput({ value, onChange }: { value: string; onChange: (v: string) => void }): JSX.Element {
  const feeMatch = value?.match(/^(\d+(?:\.\d+)?)\s*%$/);
  const isPercent = !value || feeMatch;
  if (!isPercent) {
    return <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} style={styles.input} />;
  }
  return (
    <div style={styles.helperRow}>
      <input
        type="number" min="0" step="0.5" value={feeMatch ? feeMatch[1] : ''}
        onChange={(e) => onChange(e.target.value ? `${e.target.value}%` : '')}
        style={{ ...styles.input, flex: 1 }} placeholder="0"
      />
      <span style={styles.helperSuffix}>%</span>
    </div>
  );
}

// ─── LOGIC Builder ──────────────────────────────────────

function parseLogicCondition(value: string): { question: string; yes: string; no: string } | null {
  if (!value) return null;
  const match = value.match(/^(.+?)\s+YES\s*-\s*(.+?)\s*-\s*NO\s*-\s*(.+)$/i);
  if (!match) return null;
  return { question: match[1].trim(), yes: match[2].trim(), no: match[3].trim() };
}

function LogicBuilder({ currentSpace, allSpaceNames, onFieldChange }: {
  currentSpace: SpaceRow; allSpaceNames: string[]; onFieldChange: (field: keyof SpaceRow, value: string) => void;
}): JSX.Element {
  const spaceFields = ['space_1', 'space_2', 'space_3', 'space_4', 'space_5'] as const;
  const destOptions = [...allSpaceNames, 'Space 2', 'Space 3', 'Space 4', 'Space 5'];

  return (
    <div style={styles.logicBuilder}>
      {spaceFields.map((field, idx) => {
        const raw = currentSpace[field];
        if (!raw && idx > 0) {
          if (!currentSpace.space_1 && idx > 0) return null;
          return (
            <div key={field}>
              <label style={styles.label}>Dest {idx + 1}</label>
              <SpaceSelectField label="" value="" options={allSpaceNames} onChange={(v) => onFieldChange(field, v)} />
            </div>
          );
        }
        if (!raw) {
          return (
            <div key={field}>
              <label style={styles.label}>Dest {idx + 1} (LOGIC)</label>
              <LogicFieldBuilder value="" allSpaceNames={destOptions} onChange={(v) => onFieldChange(field, v)} />
            </div>
          );
        }
        const parsed = parseLogicCondition(raw);
        if (!parsed) {
          return (
            <div key={field} style={{ marginBottom: '4px' }}>
              <label style={styles.label}>Dest {idx + 1}</label>
              <input type="text" value={raw} onChange={(e) => onFieldChange(field, e.target.value)} style={styles.input} />
              <div style={styles.logicFallback}>Complex — edit as text</div>
            </div>
          );
        }
        return (
          <div key={field} style={{ marginBottom: '4px' }}>
            <label style={styles.label}>Dest {idx + 1} (LOGIC)</label>
            <LogicFieldBuilder value={raw} allSpaceNames={destOptions} onChange={(v) => onFieldChange(field, v)} />
          </div>
        );
      })}
    </div>
  );
}

function LogicFieldBuilder({ value, allSpaceNames, onChange }: {
  value: string; allSpaceNames: string[]; onChange: (v: string) => void;
}): JSX.Element {
  const parsed = parseLogicCondition(value);
  const [question, setQuestion] = useState(parsed?.question || '');
  const [yesDest, setYesDest] = useState(parsed?.yes || '');
  const [noDest, setNoDest] = useState(parsed?.no || '');

  const rebuild = (q: string, y: string, n: string) => {
    onChange(!q && !y && !n ? '' : `${q} YES - ${y} - NO - ${n}`);
  };

  return (
    <div style={styles.logicBuilder}>
      <div style={styles.logicRow}>
        <span style={styles.logicLabel}>Q</span>
        <input type="text" value={question}
          onChange={(e) => { setQuestion(e.target.value); rebuild(e.target.value, yesDest, noDest); }}
          placeholder="e.g., Is scope ≤ $4M?" style={{ ...styles.input, flex: 1 }}
        />
      </div>
      <div style={styles.logicRow}>
        <span style={styles.logicYes}>Y→</span>
        <select value={allSpaceNames.includes(yesDest) ? yesDest : ''}
          onChange={(e) => { setYesDest(e.target.value); rebuild(question, e.target.value, noDest); }}
          style={{ ...styles.select, flex: 1 }}
        >
          <option value="">--</option>
          {allSpaceNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        {yesDest && !allSpaceNames.includes(yesDest) && (
          <input type="text" value={yesDest}
            onChange={(e) => { setYesDest(e.target.value); rebuild(question, e.target.value, noDest); }}
            style={{ ...styles.input, flex: 1 }}
          />
        )}
      </div>
      <div style={styles.logicRow}>
        <span style={styles.logicNo}>N→</span>
        <select value={allSpaceNames.includes(noDest) ? noDest : ''}
          onChange={(e) => { setNoDest(e.target.value); rebuild(question, yesDest, e.target.value); }}
          style={{ ...styles.select, flex: 1 }}
        >
          <option value="">--</option>
          {allSpaceNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        {noDest && !allSpaceNames.includes(noDest) && (
          <input type="text" value={noDest}
            onChange={(e) => { setNoDest(e.target.value); rebuild(question, yesDest, e.target.value); }}
            style={{ ...styles.input, flex: 1 }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Modal Config Expander (for Time/Fee) ──────────────────

/**
 * Returns the interpolation tokens available for a given modal effect action.
 * Used to populate context-aware placeholder hints in the editor.
 */
function getModalConfigTokens(effectAction: string): string {
  if (effectAction.startsWith('draw_')) return '{count}, {cardType}, {spaceName}, {playerName}';
  if (effectAction === 'add' || effectAction === 'deduct') return '{amount}, {spaceName}, {playerName}';
  if (effectAction === 'choice') return '{playerName}, {spaceName}';
  if (effectAction === 'negotiate') return '{playerName}, {partnerName}, {spaceName}';
  if (effectAction === 'end_game') return '{winnerName}, {spaceName}';
  if (effectAction === 'dice') return '{diceValue}, {spaceName}, {count}';
  return '{spaceName}';
}

function ModalConfigExpander({ effectAction, diceValue = '', label, getModalConfig, setModalConfigField }: {
  effectAction: string;
  diceValue?: string;
  label?: string;
  getModalConfig: (action: string, diceValue?: string) => ModalConfigRow | undefined;
  setModalConfigField: (action: string, field: keyof ModalConfigRow, value: string, diceValue?: string) => void;
}): JSX.Element {
  const config = getModalConfig(effectAction, diceValue);
  const hasConfig = config && (config.modal_title || config.modal_description || config.modal_button_label || config.modal_summary);
  const [expanded, setExpanded] = useState(!!hasConfig);
  const buttonLabel = label || 'modal config';
  const tokens = getModalConfigTokens(effectAction);

  if (!expanded) {
    return (
      <span data-editor-anchor={`modal:${effectAction}`}>
        <button
          onClick={() => setExpanded(true)}
          data-anchor-open="true"
          style={{ fontSize: '10px', color: hasConfig ? '#007bff' : '#666', fontWeight: hasConfig ? 600 : 400, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}
        >{hasConfig ? `✎ ${buttonLabel}` : `+ ${buttonLabel}`}</button>
      </span>
    );
  }

  return (
    <div style={styles.modalConfigBox} data-editor-anchor={`modal:${effectAction}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
        <span style={{ fontSize: '10px', fontWeight: 600, color: '#495057' }}>
          {label ? `${label} Overrides` : 'Modal Overrides'}
        </span>
        <button onClick={() => setExpanded(false)} style={{ fontSize: '9px', color: '#868e96', background: 'none', border: 'none', cursor: 'pointer' }}>collapse</button>
      </div>
      <div style={{ fontSize: '9px', color: '#868e96', marginBottom: '3px', fontStyle: 'italic' }}>
        Tokens: {tokens}
      </div>
      <input type="text" value={config?.modal_title || ''} onChange={(e) => setModalConfigField(effectAction, 'modal_title', e.target.value, diceValue)}
        placeholder="Modal title..." style={{ ...styles.input, fontSize: '11px', marginBottom: '2px', width: '100%' }} />
      <input type="text" value={config?.modal_description || ''} onChange={(e) => setModalConfigField(effectAction, 'modal_description', e.target.value, diceValue)}
        placeholder={`Description (${tokens})...`} style={{ ...styles.input, fontSize: '11px', marginBottom: '2px', width: '100%' }} />
      <input type="text" value={config?.modal_button_label || ''} onChange={(e) => setModalConfigField(effectAction, 'modal_button_label', e.target.value, diceValue)}
        placeholder="Button label..." style={{ ...styles.input, fontSize: '11px', marginBottom: '2px', width: '100%' }} />
      <input type="text" value={config?.modal_summary || ''} onChange={(e) => setModalConfigField(effectAction, 'modal_summary', e.target.value, diceValue)}
        placeholder="Summary text..." style={{ ...styles.input, fontSize: '11px', width: '100%' }} />
    </div>
  );
}

// ─── Styles (compact) ──────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
  placeholder: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' },
  header: {
    padding: '6px 12px', borderBottom: '1px solid #dee2e6',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8f9fa',
  },
  spaceName: { margin: 0, fontSize: '15px', fontWeight: 600, color: '#212529', flexShrink: 0 },
  titleInline: {
    padding: '3px 8px', fontSize: '13px', border: '1px solid #ced4da',
    borderRadius: '3px', flex: 1, minWidth: '120px', color: '#495057',
    fontStyle: 'italic' as const, boxSizing: 'border-box' as const,
  },
  visitToggle: { display: 'flex', gap: '2px' },
  toggleButton: {
    padding: '4px 10px', border: '1px solid #ced4da', backgroundColor: 'white',
    cursor: 'pointer', fontSize: '12px', borderRadius: '3px',
  },
  toggleButtonActive: { backgroundColor: '#007bff', color: 'white', borderColor: '#007bff' },
  formContainer: { flex: 1, overflowY: 'auto', padding: '8px' },
  fieldset: {
    border: '1px solid #dee2e6', borderRadius: '4px', padding: '6px 10px',
    marginBottom: '8px', backgroundColor: 'white',
  },
  legend: { fontSize: '11px', fontWeight: 600, color: '#495057', padding: '0 4px' },
  sectionHeaderBtn: {
    display: 'flex', alignItems: 'center', gap: '6px', width: '100%',
    background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer',
    font: 'inherit', textAlign: 'left' as const,
  },
  sectionChevron: { fontSize: '9px', color: '#adb5bd', width: '8px', flexShrink: 0 },
  sectionHeading: { fontSize: '11px', fontWeight: 700, color: '#343a40', whiteSpace: 'nowrap' as const },
  // The folded line's own contents, pushed right and dimmed so the heading
  // still reads first.
  sectionSummary: {
    fontSize: '10px', fontWeight: 400, color: '#868e96', fontStyle: 'italic' as const,
    marginLeft: 'auto', paddingLeft: '10px', minWidth: 0,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
  },
  // The words a card column shares with the player view, beside its badge.
  cardColumnName: {
    fontSize: '10px', fontWeight: 600, minWidth: 0,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
  },
  // One rule above the pop-up sections, so the eye can skip the lot.
  groupDivider: {
    fontSize: '10px', fontWeight: 700, color: '#adb5bd', textTransform: 'uppercase' as const,
    letterSpacing: '0.04em', margin: '12px 0 4px', paddingTop: '6px',
    borderTop: '1px solid #e9ecef',
  },
  // The explaining line inside a section, dimmer than anything editable.
  sectionHint: { fontSize: '10px', color: '#868e96', marginBottom: '4px' },
  fieldRow: { display: 'flex', gap: '6px', marginBottom: '6px' },
  cardGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '6px',
  },
  cardWithLabel: { display: 'flex', flexDirection: 'column' as const, minWidth: 0 },
  field: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  textareaField: { display: 'flex', flexDirection: 'column', marginBottom: '6px' },
  label: { fontSize: '10px', fontWeight: 600, color: '#343a40', marginBottom: '2px' },
  input: {
    padding: '4px 6px', fontSize: '12px', border: '1px solid #ced4da',
    borderRadius: '3px', width: '100%', boxSizing: 'border-box' as const,
  },
  inputReadOnly: { backgroundColor: '#e9ecef', color: '#6c757d' },
  select: {
    padding: '4px 6px', fontSize: '12px', border: '1px solid #ced4da',
    borderRadius: '3px', backgroundColor: 'white', width: '100%', boxSizing: 'border-box' as const,
  },
  textarea: {
    padding: '4px 6px', fontSize: '12px', border: '1px solid #ced4da', borderRadius: '3px',
    resize: 'vertical' as const, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' as const,
  },
  cardBadge: {
    display: 'inline-block', padding: '0px 4px', borderRadius: '2px',
    fontSize: '10px', fontWeight: 700, border: '1px solid', verticalAlign: 'middle',
  },
  comboRow: { display: 'flex', gap: '2px', alignItems: 'center' },
  comboToggle: {
    padding: '3px 6px', border: '1px solid #ced4da', borderRadius: '3px',
    backgroundColor: '#f8f9fa', cursor: 'pointer', fontSize: '10px', flexShrink: 0,
  },
  helperRow: { display: 'flex', gap: '4px', alignItems: 'center' },
  helperSuffix: { fontSize: '12px', color: '#495057', fontWeight: 500, flexShrink: 0 },
  logicBuilder: { display: 'flex', flexDirection: 'column' as const, gap: '4px' },
  logicRow: { display: 'flex', gap: '4px', alignItems: 'center' },
  logicLabel: { fontSize: '11px', fontWeight: 600, color: '#343a40', minWidth: '20px', flexShrink: 0 },
  logicYes: { fontSize: '11px', fontWeight: 700, color: '#28a745', minWidth: '20px', flexShrink: 0 },
  logicNo: { fontSize: '11px', fontWeight: 700, color: '#dc3545', minWidth: '20px', flexShrink: 0 },
  logicFallback: { fontSize: '10px', color: '#868e96', fontStyle: 'italic', marginTop: '2px' },
  // Modal config expander
  modalConfigBox: {
    backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '3px',
    padding: '4px 6px', marginTop: '2px',
  },
  // Button label preview
  btnPreviewGreen: {
    display: 'inline-block', padding: '3px 10px', backgroundColor: '#28a745',
    color: 'white', borderRadius: '3px', fontSize: '12px', fontWeight: 600,
  },
  btnPreviewYellow: {
    display: 'inline-block', padding: '3px 10px', backgroundColor: '#ffc107',
    color: '#212529', borderRadius: '3px', fontSize: '12px', fontWeight: 600,
  },
};
