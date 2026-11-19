import { createContext, useContext } from 'react';

// Lets the content of a menu or popover close it, without passing callbacks down by hand.

export const MenuContext = createContext(null);

/** { close({ returnFocus }) } inside a <Menu>. */
export function useMenu() {
  return useContext(MenuContext);
}

export const PopoverContext = createContext(null);

/** { close({ returnFocus }), titleId } inside a <Popover>. */
export function usePopover() {
  return useContext(PopoverContext);
}
