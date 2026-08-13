/**
 * ============================================================================
 * Toroloom — PrimaryButton
 * ============================================================================
 *
 * Primary call-to-action. Thin semantic wrapper over Button (variant=primary)
 * so screens read intent, not implementation.
 *
 *   <PrimaryButton title="Continue" onPress={go} loading={busy} />
 * ============================================================================
 */

import React from 'react';
import Button, { ButtonProps } from './Button';

export function PrimaryButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button variant="primary" {...props} />;
}

export default PrimaryButton;
