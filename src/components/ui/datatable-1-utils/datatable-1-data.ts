export interface DatatableUser {
  id: string
  name: string
  email: string
  role: string
  lastLogin: string
  twoStep: boolean
  joinedDate: string
  avatar: string
}

const avatarUrl = (seed: string) =>
  `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(seed)}`

export const usersData: DatatableUser[] = [
  { id: '1', name: 'Stella Green', email: 'stella@gmail.com', role: 'Admin', lastLogin: 'Today, 14:20', twoStep: true, joinedDate: '2026-08-20', avatar: avatarUrl('stella') },
  { id: '2', name: 'Tracy Jones', email: 'tracy@gmail.com', role: 'Editor', lastLogin: 'Yesterday', twoStep: false, joinedDate: '2026-08-20', avatar: avatarUrl('tracy') },
  { id: '3', name: 'Lisa Lucas', email: 'lisa@gmail.com', role: 'Member', lastLogin: '2 days ago', twoStep: true, joinedDate: '2026-08-20', avatar: avatarUrl('lisa') },
  { id: '4', name: 'Dorothy Erickson', email: 'dorothy@gmail.com', role: 'Member', lastLogin: 'Last week', twoStep: false, joinedDate: '2026-08-20', avatar: avatarUrl('dorothy') },
  { id: '5', name: 'Katie Brown', email: 'katie@gmail.com', role: 'Moderator', lastLogin: 'Today, 09:05', twoStep: true, joinedDate: '2026-08-20', avatar: avatarUrl('katie') },
  { id: '6', name: 'Deborah Thomas', email: 'deborah@gmail.com', role: 'Member', lastLogin: 'Today, 08:41', twoStep: false, joinedDate: '2026-08-20', avatar: avatarUrl('deborah') },
  { id: '7', name: 'Joy Hanry', email: 'joy@gmail.com', role: 'Member', lastLogin: '3 days ago', twoStep: true, joinedDate: '2026-08-20', avatar: avatarUrl('joy') },
  { id: '8', name: 'Jorge Perez', email: 'jorge@gmail.com', role: 'Editor', lastLogin: 'Last month', twoStep: false, joinedDate: '2026-08-20', avatar: avatarUrl('jorge') },
]
