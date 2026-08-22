// src/components/editor/useEditorSource.ts
//
// The editing half of the Space Data Editor, with no screen attached: the
// three CSVs read into rows, every field-change handler, whether anything is
// unsaved, and the save itself.
//
// Lifted out of DataEditor on 2026-08-22 so the merged screen's focus mode
// (SpaceDeckScreen, CARD_LIBRARY_DESIGN.md "Stage 3's screen: browse, then
// focus") can put SpaceEditor's fields beside the player view WITHOUT either
// duplicating this state or dragging the whole old editor along with it.
// DataEditor is now one consumer of this hook and the merged screen is the
// other, so there is exactly one save path and one idea of "unsaved" between
// them.
//
// The save target is unchanged and deliberately so: POST
// /api/instances/:id/content (Card Library stage 1). The old target,
// /api/admin/save-source-files, wrote the writable stock, which the server
// re-seeds from the shipped copy on every restart — so every edit saved that
// way quietly went away. Nothing here may grow a second save route.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGameContext } from '../../context/GameContext';
import { getBackendURL } from '../../utils/networkDetection';
import { getAdminPassword } from '../../utils/adminAuth';
import { SpaceRow, DiceRollRow, ModalConfigRow } from './types/EditorTypes';
import { exportSpacesCSV, exportDiceRollCSV, exportModalConfigCSV } from './utils/csvExport';
import { loadEditorSource } from './loadEditorSource';
import { DEFAULT_INSTANCE_ID } from '../board/saveBoardPosition';

export interface SaveStatus {
  type: 'success' | 'error';
  message: string;
}

export interface UseEditorSource {
  spacesData: SpaceRow[];
  diceRollData: DiceRollRow[];
  modalConfigData: ModalConfigRow[];
  /** Every space name in the source, for the "where does this lead" dropdowns. */
  allSpaceNames: string[];
  /** The two rows of the space being worked on, or null when nothing is picked. */
  spaceFirst: SpaceRow | null;
  spaceSubsequent: SpaceRow | null;
  isLoading: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  saveStatus: SaveStatus | null;
  setSaveStatus: (status: SaveStatus | null) => void;
  handleFieldChange: (visitType: 'First' | 'Subsequent', field: keyof SpaceRow, value: string) => void;
  handleDisplayLabelChange: (value: string) => void;
  handleDiceRollUpdate: (index: number, field: keyof DiceRollRow, value: string) => void;
  handleAddDiceRoll: (roll: DiceRollRow) => void;
  handleDeleteDiceRoll: (index: number) => void;
  handleModalConfigChange: (configs: ModalConfigRow[]) => void;
  /** Adds an empty First + Subsequent pair. Picking it is the caller's job. */
  handleAddSpace: (spaceName: string) => void;
  handleDeleteSpace: (spaceName: string) => void;
  handleSave: () => Promise<void>;
  /** Destructive admin-only reset; DataEditor is the only screen offering it. */
  handleResetToBaseline: () => Promise<void>;
}

/**
 * @param selectedSpaceName which space the field handlers write to; null when
 *   nothing is picked yet.
 * @param reloadToken change this to make the three CSVs be read again — after
 *   a change made somewhere else (switching a space to another version, say)
 *   the rows on screen are stale until they are re-read.
 */
export function useEditorSource(
  selectedSpaceName: string | null,
  reloadToken: number = 0
): UseEditorSource {
  const { dataService } = useGameContext();

  const [spacesData, setSpacesData] = useState<SpaceRow[]>([]);
  const [diceRollData, setDiceRollData] = useState<DiceRollRow[]>([]);
  const [modalConfigData, setModalConfigData] = useState<ModalConfigRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Shared with the browse screen (loadEditorSource.ts) so the two can
        // never read the same three CSVs in two slightly different ways.
        const source = await loadEditorSource();
        if (cancelled) return;
        setSpacesData(source.spaces);
        setDiceRollData(source.diceRolls);
        setModalConfigData(source.modalConfigs);
        setIsLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error('Error loading source files:', err);
        setError('Failed to load source files. Make sure SOURCE_FILES are in public/data/SOURCE_FILES/');
        setIsLoading(false);
      }
    };
    void loadData();
    return () => { cancelled = true; };
  }, [dataService, reloadToken]);

  const allSpaceNames = useMemo(() => {
    const names = new Set<string>();
    spacesData.forEach(space => names.add(space.space_name));
    return Array.from(names).sort();
  }, [spacesData]);

  const spaceFirst = spacesData.find(
    s => s.space_name === selectedSpaceName && s.visit_type === 'First'
  ) || null;
  const spaceSubsequent = spacesData.find(
    s => s.space_name === selectedSpaceName && s.visit_type === 'Subsequent'
  ) || null;

  const handleFieldChange = useCallback((
    vType: 'First' | 'Subsequent',
    field: keyof SpaceRow,
    value: string
  ) => {
    setSpacesData(prev => prev.map(space => {
      if (space.space_name === selectedSpaceName && space.visit_type === vType) {
        return { ...space, [field]: value };
      }
      return space;
    }));
    setHasUnsavedChanges(true);
  }, [selectedSpaceName]);

  // Tile label (display_label_override) is a per-space GAME_CONFIG value that
  // rides in _extraColumns. It must stay identical on the First + Subsequent
  // rows so the regenerated GAME_CONFIG.csv carries one consistent value
  // regardless of which visit row the regen reads. Update both at once.
  const handleDisplayLabelChange = useCallback((value: string) => {
    setSpacesData(prev => prev.map(space => {
      if (space.space_name === selectedSpaceName) {
        return {
          ...space,
          _extraColumns: { ...(space._extraColumns ?? {}), display_label_override: value },
        };
      }
      return space;
    }));
    setHasUnsavedChanges(true);
  }, [selectedSpaceName]);

  const handleDiceRollUpdate = useCallback((
    index: number,
    field: keyof DiceRollRow,
    value: string
  ) => {
    setDiceRollData(prev => prev.map((roll, i) => (i === index ? { ...roll, [field]: value } : roll)));
    setHasUnsavedChanges(true);
  }, []);

  const handleAddDiceRoll = useCallback((newRoll: DiceRollRow) => {
    setDiceRollData(prev => [...prev, newRoll]);
    setHasUnsavedChanges(true);
  }, []);

  const handleDeleteDiceRoll = useCallback((index: number) => {
    if (!confirm('Delete this dice roll row?')) return;
    setDiceRollData(prev => prev.filter((_, i) => i !== index));
    setHasUnsavedChanges(true);
  }, []);

  const handleModalConfigChange = useCallback((configs: ModalConfigRow[]) => {
    setModalConfigData(configs);
    setHasUnsavedChanges(true);
  }, []);

  const handleAddSpace = useCallback((spaceName: string) => {
    // Determine default phase from the first space (or SETUP)
    const defaultPhase = spacesData.length > 0 ? spacesData[0].phase : 'SETUP';
    const newFirst: SpaceRow = {
      space_name: spaceName,
      phase: defaultPhase,
      visit_type: 'First',
      Title: '', Event: '', Action: '', Outcome: '',
      w_card: '', b_card: '', i_card: '', l_card: '', e_card: '',
      Time: '', Fee: '',
      space_1: '', space_2: '', space_3: '', space_4: '', space_5: '',
      Negotiate: '', requires_dice_roll: '', path: 'Main', rolls: '',
      end_turn_label: 'End Turn', try_again_label: 'Try Again',
      w_card_label: '', b_card_label: '', i_card_label: '', l_card_label: '', e_card_label: '',
      shake_on: '', tts_field: '',
      w_card_narrative: '', b_card_narrative: '', i_card_narrative: '', l_card_narrative: '', e_card_narrative: ''
    };
    const newSubsequent: SpaceRow = { ...newFirst, visit_type: 'Subsequent' };
    setSpacesData(prev => [...prev, newFirst, newSubsequent]);
    setHasUnsavedChanges(true);
  }, [spacesData]);

  const handleDeleteSpace = useCallback((spaceName: string) => {
    setSpacesData(prev => prev.filter(s => s.space_name !== spaceName));
    setDiceRollData(prev => prev.filter(d => d.space_name !== spaceName));
    setHasUnsavedChanges(true);
  }, []);

  const handleSave = useCallback(async () => {
    const password = getAdminPassword();
    if (!password) {
      setSaveStatus({ type: 'error', message: 'Admin session expired. Please re-open the editor.' });
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);

    try {
      const backendURL = getBackendURL();
      const spacesCSV = exportSpacesCSV(spacesData);
      const diceRollCSV = exportDiceRollCSV(diceRollData);
      const modalConfigCSV = exportModalConfigCSV(modalConfigData);

      // Saves go to the CLASSROOM, not to the master CSVs (Card Library
      // stage 1, docs/core/CARD_LIBRARY_DESIGN.md). The old target,
      // /api/admin/save-source-files, wrote the writable stock — which the
      // server re-seeds from the shipped copy on every restart, so every edit
      // saved here quietly went away. Same three CSVs, same password header:
      // the server works out which spaces actually changed and stores just
      // those as cards, which survive restarts and deploys by construction.
      const response = await fetch(`${backendURL}/api/instances/${DEFAULT_INSTANCE_ID}/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ spacesCSV, diceRollCSV, modalConfigCSV })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setHasUnsavedChanges(false);
        // Refresh DataService's in-memory caches so gameplay sees the new CSVs
        // without a hard browser reload. Without this, SPACE_EFFECTS / DICE_EFFECTS
        // / MOVEMENT stay stale until the user hits Ctrl+Shift+R — same trap as
        // the v2.69.4 reloadGameConfig fix, generalized in v2.70.1.
        try {
          await dataService.reloadAllData();
        } catch (reloadErr) {
          console.warn('[useEditorSource] Save succeeded but in-memory reload failed:', reloadErr);
        }
        // Say what actually happened, in plain language. The old message
        // ("N files regenerated") described machinery, and described it
        // wrongly now — nothing is regenerated, the changed spaces are saved
        // into the classroom. The counts come from the server's own diff.
        const saved = (data.created?.length ?? 0) + (data.updated?.length ?? 0);
        setSaveStatus({
          type: 'success',
          message: saved === 0
            ? 'Saved. Nothing had changed, so nothing needed storing.'
            : `Saved! ${saved} ${saved === 1 ? 'space is' : 'spaces are'} stored in the classroom — `
              + 'these stay put through restarts and updates.',
        });
        // Auto-clear success message after 4 seconds
        setTimeout(() => setSaveStatus(prev => prev?.type === 'success' ? null : prev), 4000);
      } else {
        // A rejected save comes back one of two ways: the per-step diagnostic
        // (step + detail) this has always shown, or — new with the classroom
        // save path — a 422 carrying the validation report, whose first error
        // says in words what is wrong with the edit. Both are surfaced.
        const base = data.error || data.report?.errors?.[0]?.message || 'Save failed';
        const detail = data.detail ? ` (${data.step || 'unknown'}: ${data.detail})` : '';
        setSaveStatus({ type: 'error', message: base + detail });
      }
    } catch (err) {
      setSaveStatus({ type: 'error', message: 'Connection error: ' + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setIsSaving(false);
    }
  }, [spacesData, diceRollData, modalConfigData, dataService]);

  const handleResetToBaseline = useCallback(async () => {
    const confirmed = window.confirm(
      'Reset to Baseline?\n\n' +
      'This will revert ALL space and dice roll data to the original defaults ' +
      'that were baked into the Docker image.\n\n' +
      'Any changes you\'ve saved will be lost.\n\n' +
      'Continue?'
    );
    if (!confirmed) return;

    const password = getAdminPassword();
    if (!password) {
      setSaveStatus({ type: 'error', message: 'Admin session expired. Please re-open the editor.' });
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);

    try {
      const backendURL = getBackendURL();
      const response = await fetch(`${backendURL}/api/admin/reset-to-baseline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSaveStatus({ type: 'success', message: 'Reset to baseline! Reloading data...' });
        // Reload the data from server
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setSaveStatus({ type: 'error', message: data.error || 'Reset failed' });
      }
    } catch (err) {
      setSaveStatus({ type: 'error', message: 'Connection error: ' + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setIsSaving(false);
    }
  }, []);

  return {
    spacesData,
    diceRollData,
    modalConfigData,
    allSpaceNames,
    spaceFirst,
    spaceSubsequent,
    isLoading,
    error,
    hasUnsavedChanges,
    isSaving,
    saveStatus,
    setSaveStatus,
    handleFieldChange,
    handleDisplayLabelChange,
    handleDiceRollUpdate,
    handleAddDiceRoll,
    handleDeleteDiceRoll,
    handleModalConfigChange,
    handleAddSpace,
    handleDeleteSpace,
    handleSave,
    handleResetToBaseline,
  };
}
