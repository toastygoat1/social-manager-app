import type { DragEvent as ReactDragEvent } from "react";
import type { SchedulerEvent } from "./data";

export type SchedulerDragController = {
  draggingEventId: string | null;
  dropTargetIso: string | null;
  movingEventId: string | null;
  onEventDragStart: (
    event: SchedulerEvent,
    dragEvent: ReactDragEvent<HTMLElement>,
  ) => void;
  onEventDragEnd: () => void;
  onDateDragEnter: (
    iso: string,
    dragEvent: ReactDragEvent<HTMLElement>,
  ) => void;
  onDateDragOver: (
    iso: string,
    dragEvent: ReactDragEvent<HTMLElement>,
  ) => void;
  onDateDragLeave: (
    iso: string,
    dragEvent: ReactDragEvent<HTMLElement>,
  ) => void;
  onDateDrop: (iso: string, dragEvent: ReactDragEvent<HTMLElement>) => void;
};

export function canDragSchedulerEvent(event: SchedulerEvent) {
  return (
    event.source === "scheduled_post" &&
    event.status === "scheduled" &&
    event.id.startsWith("post:")
  );
}

export function getDateDropProps(
  dragController: SchedulerDragController | undefined,
  iso: string,
) {
  return {
    onDragEnter: (dragEvent: ReactDragEvent<HTMLElement>) =>
      dragController?.onDateDragEnter(iso, dragEvent),
    onDragOver: (dragEvent: ReactDragEvent<HTMLElement>) =>
      dragController?.onDateDragOver(iso, dragEvent),
    onDragLeave: (dragEvent: ReactDragEvent<HTMLElement>) =>
      dragController?.onDateDragLeave(iso, dragEvent),
    onDrop: (dragEvent: ReactDragEvent<HTMLElement>) =>
      dragController?.onDateDrop(iso, dragEvent),
  };
}
