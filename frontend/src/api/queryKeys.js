// Every cached query's key in one place. Keys are grouped under a prefix (dashboard, gigs,
// payments, clients), so a change can refresh a whole group with one invalidateQueries call.
export const queryKeys = {
  dashboard: (params) => ['dashboard', params],
  gigs: {
    all: ['gigs'],
    list: (params) => ['gigs', 'list', params],
    detail: (id) => ['gigs', 'detail', id],
    payments: (id) => ['gigs', 'detail', id, 'payments'],
    attachments: (id) => ['gigs', 'detail', id, 'attachments'],
  },
  payments: {
    all: ['payments'],
    list: (params) => ['payments', 'list', params],
  },
  clients: {
    all: ['clients'],
    list: (params) => ['clients', 'list', params],
    detail: (id) => ['clients', 'detail', id],
  },
  demo: ['demo'],
};
