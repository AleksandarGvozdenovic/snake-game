export const TILE = 4;
export const FIELD_TOP = 8;

export type Sprite = Readonly<{
  width: number;
  height: number;
  pixels: readonly string[];
}>;

function makeSprite(...rows: string[]): Sprite {
  const width = rows[0]?.length ?? 0;

  if (
    width === 0 ||
    rows.some(
      (row) =>
        row.length !== width ||
        /[^01]/.test(row),
    )
  ) {
    throw new Error(
      'Invalid Snake II sprite bitmap',
    );
  }

  return {
    width,
    height: rows.length,
    pixels: rows,
  };
}

export const HEAD_UP_CLOSED = makeSprite(
  '0110',
  '0110',
  '1010',
  '0110',
  '0010',
  '0000',
);

export const HEAD_UP_OPEN = makeSprite(
  '1001',
  '1001',
  '1010',
  '0110',
  '0010',
  '0000',
);

export const BODY_HORIZONTAL = makeSprite(
  '0000',
  '1011',
  '1101',
  '0000',
);

export const CORNER_UP_LEFT = makeSprite(
  '0110',
  '1110',
  '1100',
  '0000',
);

export const TAIL_TOWARD_RIGHT = makeSprite(
  '0000',
  '0011',
  '1111',
  '0000',
);

export const DIGEST = makeSprite(
  '0110',
  '1111',
  '1111',
  '0110',
);

export const FOOD = makeSprite(
  '0100',
  '1010',
  '0100',
  '0000',
);

export const BONUS = makeSprite(
  '1001',
  '0110',
  '0110',
  '1001',
);

export function rotateSprite(
  source: Sprite,
  clockwiseTurns: number,
): Sprite {
  const turns =
    ((clockwiseTurns % 4) + 4) % 4;

  let result = source;

  for (let turn = 0; turn < turns; turn++) {
    const newRows: string[] = [];

    for (let y = 0; y < result.width; y++) {
      let row = '';

      for (
        let x = result.height - 1;
        x >= 0;
        x--
      ) {
        row += result.pixels[x][y];
      }

      newRows.push(row);
    }

    result = makeSprite(...newRows);
  }

  return result;
}
