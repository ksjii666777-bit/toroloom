/**
 * ============================================================================
 * Toroloom — SecondaryButton
 * ============================================================================
 *
 * Secondary action (outlined). Thin semantic wrapper over Button
 * (variant=outline) so screens read intent, not implementation.
 *
 *   <SecondaryButton title="Cancel" onPress={back} />
 * ============================================================================
 */

import React from 'react';
import Button, { ButtonProps } from './Button';

export function SecondaryButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button variant="outline" {...props} />;
}

export default SecondaryButton;
