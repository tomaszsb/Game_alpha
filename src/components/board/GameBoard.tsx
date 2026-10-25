// GameBoard - picks the board to draw: the classic board (BoardCanvas) or the town (TownBoard).
// The town shows only when this screen chose it (Menu: "Board: Town"), this board has a town
// (TOWN.csv), and nobody is moving squares (edit mode always uses the classic board). Every other
// prop goes to the classic board unchanged, and on Classic nothing new runs at all.

import React from 'react';
import { BoardCanvas, type BoardCanvasProps } from './BoardCanvas';
import { TownBoard, useTownLayout } from './TownBoard';
import { useBoardStyle } from '../../utils/boardStyle';

function TownOrClassic(props: BoardCanvasProps) {
  const layout = useTownLayout(props.players.length);
  if (!layout) return <BoardCanvas {...props} />;
  return (
    <TownBoard
      currentPlayerId={props.currentPlayerId}
      players={props.players}
      centerOnCurrent={props.centerOnCurrent}
      mode={props.mode}
      focusRequest={props.focusRequest}
      screen={props.screen}
      layout={layout}
    />
  );
}

export function GameBoard(props: BoardCanvasProps) {
  const [style] = useBoardStyle();
  if (style !== 'town' || props.isAdmin) return <BoardCanvas {...props} />;
  return <TownOrClassic {...props} />;
}
