# useEventHistory Hook

A React hook for reading events from deployed smart contracts using ethers v6, without dependencies on viem, wagmi, or tanstack/react-query.

## Features

- ✅ Uses only ethers v6 for blockchain interactions
- ✅ TypeScript support with full type safety
- ✅ Real-time event watching with configurable polling
- ✅ Optional block, transaction, and receipt data fetching
- ✅ Event filtering support
- ✅ Automatic deduplication of events
- ✅ Error handling and loading states
- ✅ Manual refetch capability

## Installation

The hook is already included in the project. Make sure you have ethers v6 installed:

```bash
yarn add ethers@^6.13.2
```

## Usage

### Basic Usage

```tsx
import { useEventHistory } from "~~/hooks/scaffold-eth/useEventHistory";

function MyComponent() {
  const {
    data: events,
    status,
    error,
    isLoading,
    isFetchingNewEvent,
    refetch,
  } = useEventHistory({
    contractName: "Staker",
    eventName: "Stake",
    fromBlock: BigInt(0),
    watch: true,
    enabled: true,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>Events ({events?.length || 0})</h2>
      {events?.map((event, index) => (
        <div key={`${event.transactionHash}-${event.logIndex}`}>
          <h3>Event #{index + 1}</h3>
          <p>Block: {event.blockNumber.toString()}</p>
          <p>Transaction: {event.transactionHash}</p>
          <pre>{JSON.stringify(event.args, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
}
```

### Advanced Usage with Additional Data

```tsx
const {
  data: events,
  status,
  error,
  isLoading,
  refetch,
} = useEventHistory({
  contractName: "Staker",
  eventName: "Stake",
  fromBlock: BigInt(1000000), // Start from specific block
  watch: true,
  enabled: true,
  // Include additional data
  blockData: true,
  transactionData: true,
  receiptData: true,
  // Custom polling interval (default: 30000ms)
  pollingInterval: 15000,
  // Event filters
  filters: {
    user: "0x1234...", // Filter by indexed parameter
  },
});
```

## API Reference

### Configuration

```tsx
type UseEventHistoryConfig<
  TContractName extends ContractName,
  TEventName extends ExtractAbiEventNames<ContractAbi<TContractName>>,
  TBlockData extends boolean = false,
  TTransactionData extends boolean = false,
  TReceiptData extends boolean = false,
> = {
  contractName: TContractName; // Name of the deployed contract
  eventName: TEventName; // Name of the event to listen for
  fromBlock: bigint; // Block number to start reading from
  chainId?: AllowedChainIds; // Optional chain ID
  filters?: Record<string, any>; // Event filters for indexed parameters
  blockData?: TBlockData; // Include block data (default: false)
  transactionData?: TTransactionData; // Include transaction data (default: false)
  receiptData?: TReceiptData; // Include receipt data (default: false)
  watch?: boolean; // Enable real-time watching (default: false)
  enabled?: boolean; // Enable the hook (default: true)
  pollingInterval?: number; // Polling interval in ms (default: 30000)
};
```

### Return Value

```tsx
type UseEventHistoryReturn<
  TContractName extends ContractName,
  TEventName extends ExtractAbiEventNames<ContractAbi<TContractName>>,
  TBlockData extends boolean = false,
  TTransactionData extends boolean = false,
  TReceiptData extends boolean = false,
> = {
  data: UseEventHistoryData<TContractName, TEventName, TBlockData, TTransactionData, TReceiptData> | undefined;
  status: "idle" | "loading" | "success" | "error";
  error: Error | null;
  isLoading: boolean;
  isFetchingNewEvent: boolean;
  refetch: () => Promise<void>;
};
```

### Event Data Structure

```tsx
type UseEventHistoryData<
  TContractName extends ContractName,
  TEventName extends ExtractAbiEventNames<ContractAbi<TContractName>>,
  TBlockData extends boolean = false,
  TTransactionData extends boolean = false,
  TReceiptData extends boolean = false,
> = Array<{
  args: Record<string, any>; // Parsed event arguments
  blockNumber: bigint; // Block number
  blockHash: string; // Block hash
  transactionHash: string; // Transaction hash
  logIndex: number; // Log index
  address: string; // Contract address
  topics: string[]; // Event topics
  data: string; // Raw log data
  blockData: TBlockData extends true ? any : null; // Block data if requested
  transactionData: TTransactionData extends true ? any : null; // Transaction data if requested
  receiptData: TReceiptData extends true ? any : null; // Receipt data if requested
}>;
```

## Examples

### Filtering Events

```tsx
// Filter by indexed parameter
const { data: events } = useEventHistory({
  contractName: "Staker",
  eventName: "Stake",
  fromBlock: BigInt(0),
  filters: {
    user: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
  },
});
```

### Conditional Fetching

```tsx
const { data: events } = useEventHistory({
  contractName: "Staker",
  eventName: "Stake",
  fromBlock: BigInt(0),
  enabled: !!userAddress, // Only fetch if userAddress exists
  watch: !!userAddress, // Only watch if userAddress exists
});
```

### Manual Refetch

```tsx
const { data: events, refetch } = useEventHistory({
  contractName: "Staker",
  eventName: "Stake",
  fromBlock: BigInt(0),
  watch: false, // Disable automatic watching
});

// Manual refresh
const handleRefresh = () => {
  refetch();
};
```

## Network Configuration

The hook automatically uses the correct provider based on the chain ID:

- **Hardhat (31337)**: Uses `http://127.0.0.1:8545`
- **Other networks**: Uses the RPC URL from `NEXT_PUBLIC_RPC_URL` environment variable or Alchemy API

You can extend the `getProvider` function in the hook to support additional networks.

## Error Handling

The hook provides comprehensive error handling:

```tsx
const { data: events, status, error, isLoading } = useEventHistory({
  contractName: "Staker",
  eventName: "Stake",
  fromBlock: BigInt(0),
});

if (status === "error") {
  console.error("Failed to fetch events:", error);
  return <div>Error: {error?.message}</div>;
}
```

## Performance Considerations

- **Polling Interval**: Adjust the `pollingInterval` based on your needs. Lower values provide more real-time updates but increase RPC calls.
- **Block Range**: Use specific `fromBlock` values instead of `0` to reduce the number of events fetched.
- **Filters**: Use event filters to reduce the number of events processed.
- **Additional Data**: Only enable `blockData`, `transactionData`, or `receiptData` when needed as they require additional RPC calls.

## Comparison with useScaffoldEventHistory

| Feature           | useEventHistory | useScaffoldEventHistory             |
| ----------------- | --------------- | ----------------------------------- |
| Dependencies      | ethers v6 only  | viem + wagmi + tanstack/react-query |
| Bundle Size       | Smaller         | Larger                              |
| Type Safety       | ✅              | ✅                                  |
| Real-time Updates | ✅              | ✅                                  |
| Event Filtering   | ✅              | ✅                                  |
| Additional Data   | ✅              | ✅                                  |
| Error Handling    | ✅              | ✅                                  |
| Manual Refetch    | ✅              | ✅                                  |

## Troubleshooting

### Common Issues

1. **"Event not found" error**: Make sure the event name matches exactly with the contract ABI.
2. **"Contract not found" error**: Ensure the contract is deployed and the contract name is correct.
3. **No events returned**: Check if the `fromBlock` is correct and the contract has emitted events.
4. **Network issues**: Verify the RPC URL and network configuration.

### Debug Mode

Enable additional logging by setting the environment variable:

```bash
NEXT_PUBLIC_DEBUG_EVENTS=true
```

This will log additional information about event fetching and processing.
