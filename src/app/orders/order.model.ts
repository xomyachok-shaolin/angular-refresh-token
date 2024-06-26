export interface Order {
    id: number;                  // Unique identifier for the order
    number: string;              // Order number
    types: string[];                // Type of the order
    date: Date;                // Date of order placement
    status: string;              // Current status of the order
    cost: number;                // Total cost of the order
    paymentStatus: string;       // Status of payment (e.g., 'Paid', 'Unpaid')
  }
  