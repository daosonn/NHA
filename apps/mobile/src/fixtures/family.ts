import type { FamilyTreeData } from '../components/family/tree-layout';

/**
 * Stand-in tree. Replace with the API once family/relationship endpoints
 * exist — see docs/02-backend/database.md for the real shape.
 */
export const familyTree: FamilyTreeData = {
  name: "Mom's side",
  memberCount: 9,
  pendingCount: 1,
  generations: [
    {
      id: 'g1',
      label: 'GEN 1',
      members: [
        { id: 'ba-lan', name: 'Ba Lan', role: 'Grandmother', tone: 'dark', state: 'active' },
        { id: 'ong-tuan', name: 'Ong Tuan', role: 'Grandfather', tone: 'light', state: 'active' },
      ],
    },
    {
      id: 'g2',
      label: 'GEN 2',
      members: [
        { id: 'mai', name: 'Mai', role: 'Mother', tone: 'dark', state: 'active' },
        { id: 'hoang', name: 'Hoang', role: 'Father', tone: 'light', state: 'active' },
      ],
    },
    {
      id: 'g3',
      label: 'GEN 3',
      members: [
        { id: 'minh', name: 'Minh', role: 'You', tone: 'light', state: 'active', isViewer: true },
        { id: 'linh', name: 'Linh', role: 'Sister', tone: 'dark', state: 'pending' },
      ],
    },
  ],
  couples: [{ members: ['ba-lan', 'ong-tuan'] }, { members: ['mai', 'hoang'] }],
  descents: [
    { from: ['ba-lan', 'ong-tuan'], to: 'mai' },
    { from: ['mai', 'hoang'], to: 'minh' },
    { from: ['mai', 'hoang'], to: 'linh' },
  ],
};
