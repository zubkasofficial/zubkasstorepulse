import type { Customer, Order } from '@/data/mockData'

/**
 * Resolve the best display name for an order's customer.
 *
 * 1. If the order already has a non-empty, non-"Guest" customer name, use it.
 * 2. Otherwise, look up the connected customers list by customer_id or billing email.
 * 3. If found, use the registered customer name.
 * 4. Fall back to "Guest" only if nothing else is available.
 */
export function resolveCustomerName(order: Order, customers: Customer[]): string {
  const name = order.customer?.trim()
  if (name && name !== 'Guest') return name

  if (customers.length > 0) {
    let match: Customer | undefined
    if (order.customerId) {
      match = customers.find((c) => c.id === order.customerId)
    }
    if (!match && order.email) {
      match = customers.find(
        (c) => c.email.toLowerCase() === order.email.toLowerCase(),
      )
    }
    if (match && match.name && match.name !== 'Guest') return match.name
  }

  return 'Guest'
}
