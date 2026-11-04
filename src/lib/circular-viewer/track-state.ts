import type { CustomTrackQuery } from "./contract";
import {
  canSetForeground,
  customTrack,
  defaultTracks,
  userTrack,
  type CircularTrack,
} from "./tracks";
import type { ParsedUserTrack, UserPlotType } from "./user-track";

export interface TrackState {
  tracks: readonly CircularTrack[];
  /** Legacy numbered custom and user tracks from 1 and never reused a number. */
  customCount: number;
  userCount: number;
}

export type TrackAction =
  | { type: "toggle"; id: string }
  | { type: "remove"; id: string }
  | { type: "setForeground"; id: string; color: string }
  | { type: "setBackground"; id: string; color: string }
  | { type: "addCustom"; query: CustomTrackQuery; name: string }
  | { type: "addUser"; plot: UserPlotType; parsed: ParsedUserTrack; fileName: string; name: string };

export function initialTrackState(): TrackState {
  return { tracks: defaultTracks(), customCount: 0, userCount: 0 };
}

function update(
  state: TrackState,
  id: string,
  change: (track: CircularTrack) => CircularTrack,
): TrackState {
  return { ...state, tracks: state.tracks.map((track) => (track.id === id ? change(track) : track)) };
}

export function trackReducer(state: TrackState, action: TrackAction): TrackState {
  switch (action.type) {
    case "toggle":
      return update(state, action.id, (track) => (track.fixed ? track : { ...track, visible: !track.visible }));
    case "remove":
      return { ...state, tracks: state.tracks.filter((track) => track.id !== action.id || track.fixed) };
    case "setForeground":
      return update(state, action.id, (track) =>
        canSetForeground(track)
          ? { ...track, foreground: action.color, darkForeground: null }
          : track,
      );
    case "setBackground":
      return update(state, action.id, (track) => ({ ...track, background: action.color }));
    case "addCustom": {
      const index = state.customCount + 1;
      return {
        ...state,
        customCount: index,
        tracks: [...state.tracks, customTrack(index, action.query, action.name)],
      };
    }
    case "addUser": {
      const index = state.userCount + 1;
      return {
        ...state,
        userCount: index,
        tracks: [...state.tracks, userTrack(index, action.plot, action.parsed, action.fileName, action.name)],
      };
    }
  }
}
