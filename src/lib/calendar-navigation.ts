let resetCalendarHandler: (() => void) | undefined;

export function registerCalendarResetHandler(handler: () => void) {
  resetCalendarHandler = handler;
  return () => {
    if (resetCalendarHandler === handler) resetCalendarHandler = undefined;
  };
}

export function resetCalendarToToday() {
  resetCalendarHandler?.();
}
