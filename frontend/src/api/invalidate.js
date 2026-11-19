/**
 * After anything that changes money or names (a payment, a gig, a client), refresh every group
 * that can show it: gig lists and details, the payments list, the dashboard and the clients'
 * owed amounts. One rule instead of a list per mutation; only queries on screen refetch now,
 * the rest refetch when they are next shown.
 */
export function invalidateMoneyData(queryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['gigs'] }),
    queryClient.invalidateQueries({ queryKey: ['payments'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['clients'] }),
  ]);
}
