import { TextInput, type TextInputProps } from 'react-native';

import { colors } from '../../theme';
import { useTypeface } from '../../theme/typeface';

export type NoteFieldProps = Omit<TextInputProps, 'style' | 'placeholderTextColor'> & {
  /** `bold` for the title line, `regular` for the body. */
  weight: 'bold' | 'regular';
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
};

/**
 * A borderless line of writing inside the note card (mockup 1f).
 *
 * Not `TextField`: that draws its own white surface with a border, and the
 * editor puts both of these inside one card already — nesting a bordered box
 * in a bordered box makes the screen read as a form rather than as a page
 * being written on, which is the whole point of 1f.
 *
 * `TextInput` cannot use the `Text` primitive, so the face is applied by hand.
 * React Native has no synthetic bolding: every weight is a separate loaded
 * family, and skipping this leaves one control on the screen silently drawing
 * in the system font (`docs/01-frontend/design-system.md`).
 */
export function NoteField({
  weight,
  fontSize,
  lineHeight,
  letterSpacing,
  ...rest
}: NoteFieldProps) {
  const typeface = useTypeface(weight === 'bold' ? 'bold' : 'regular');

  return (
    <TextInput
      {...rest}
      multiline
      placeholderTextColor={colors.text.subtle}
      // The caret is the one coral mark on the card, which is what makes an
      // untouched note look like somewhere to start typing.
      cursorColor={colors.coral.brand}
      selectionColor={colors.coral.brand}
      style={{
        ...typeface,
        fontSize,
        lineHeight,
        letterSpacing,
        color: weight === 'bold' ? colors.text.primary : colors.text.body,
        padding: 0,
        textAlignVertical: 'top',
      }}
    />
  );
}
