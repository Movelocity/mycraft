// Block definitions for Web Minecraft Demo
// Each block has display name, per-face colors (hex int), and physics flags

export type BlockType =
  | 'air'
  | 'grass'
  | 'dirt'
  | 'stone'
  | 'cobblestone'
  | 'sand'
  | 'wood'
  | 'planks'
  | 'leaves'
  | 'water'
  | 'glass'
  | 'bedrock'
  | 'coal_ore'
  | 'iron_ore'
  | 'gold_ore'
  | 'diamond_ore'
  | 'gravel'
  | 'snow';

export interface BlockDef {
  name: string;
  color: {  // 图标颜色
    side: number;      // hex int, e.g. 0x8B5E3C
    top?: number;      // override for top face
    bottom?: number;   // override for bottom face
  };
  transparent: boolean;
  liquid: boolean;
  solid: boolean;      // collision box (defaults to !transparent)
}

export const BLOCKS: Record<BlockType, BlockDef> = {
  air: {
    name: 'Air',
    color: { side: 0x000000 },
    transparent: true,
    liquid: false,
    solid: false,
  },
  grass: {
    name: 'Grass',
    color: { side: 0x6B8C3E, top: 0x5D8A3C, bottom: 0x8B5E3C },
    transparent: false,
    liquid: false,
    solid: true,
  },
  dirt: {
    name: 'Dirt',
    color: { side: 0x8B5E3C },
    transparent: false,
    liquid: false,
    solid: true,
  },
  stone: {
    name: 'Stone',
    color: { side: 0x7F7F7F },
    transparent: false,
    liquid: false,
    solid: true,
  },
  cobblestone: {
    name: 'Cobblestone',
    color: { side: 0x6B6B6B },
    transparent: false,
    liquid: false,
    solid: true,
  },
  sand: {
    name: 'Sand',
    color: { side: 0xDDCC88 },
    transparent: false,
    liquid: false,
    solid: true,
  },
  wood: {
    name: 'Wood',
    color: { side: 0x7A5230, top: 0x967046, bottom: 0x967046 },
    transparent: false,
    liquid: false,
    solid: true,
  },
  planks: {
    name: 'Planks',
    color: { side: 0xC8A060 },
    transparent: false,
    liquid: false,
    solid: true,
  },
  leaves: {
    name: 'Leaves',
    color: { side: 0x3A7A20 },
    transparent: true,
    liquid: false,
    solid: true,
  },
  water: {
    name: 'Water',
    color: { side: 0x2255AA },
    transparent: true,
    liquid: true,
    solid: false,
  },
  glass: {
    name: 'Glass',
    color: { side: 0xAACCEE },
    transparent: true,
    liquid: false,
    solid: true,
  },
  bedrock: {
    name: 'Bedrock',
    color: { side: 0x3C3C3C },
    transparent: false,
    liquid: false,
    solid: true,
  },
  coal_ore: {
    name: 'Coal Ore',
    color: { side: 0x646464 },
    transparent: false,
    liquid: false,
    solid: true,
  },
  iron_ore: {
    name: 'Iron Ore',
    color: { side: 0x969696 },
    transparent: false,
    liquid: false,
    solid: true,
  },
  gold_ore: {
    name: 'Gold Ore',
    color: { side: 0x969682 },
    transparent: false,
    liquid: false,
    solid: true,
  },
  diamond_ore: {
    name: 'Diamond Ore',
    color: { side: 0x829696 },
    transparent: false,
    liquid: false,
    solid: true,
  },
  gravel: {
    name: 'Gravel',
    color: { side: 0x787878 },
    transparent: false,
    liquid: false,
    solid: true,
  },
  snow: {
    name: 'Snow',
    color: { side: 0xEEEEFF },
    transparent: false,
    liquid: false,
    solid: true,
  },
};

/** Blocks available in the hotbar (index 1–9) */
export const HOTBAR_BLOCKS: BlockType[] = [
  'grass',
  'dirt',
  'stone',
  'cobblestone',
  'planks',
  'sand',
  'wood',
  'glass',
  'snow',
];
