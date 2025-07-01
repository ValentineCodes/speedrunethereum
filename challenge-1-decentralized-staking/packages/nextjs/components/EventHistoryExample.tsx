import React from "react";
import { useEventHistory } from "~~/hooks/scaffold-eth/useEventHistory";

/**
 * Example component demonstrating the useEventHistory hook
 * This component shows how to fetch and display events from a contract
 */
export const EventHistoryExample: React.FC = () => {
  // Example usage of the useEventHistory hook
  const {
    data: events,
    status,
    error,
    isLoading,
    isFetchingNewEvent,
    refetch,
  } = useEventHistory({
    contractName: "Staker", // Replace with your actual contract name
    eventName: "Stake", // Replace with your actual event name
    fromBlock: BigInt(0), // Start from block 0
    watch: true, // Enable watching for new events
    enabled: true, // Enable the hook
    // Optional: include additional data
    // blockData: true,
    // transactionData: true,
    // receiptData: true,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-lg">Loading events...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
        <h3 className="font-bold">Error loading events:</h3>
        <p>{error.message}</p>
        <button onClick={refetch} className="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Event History</h2>
        <div className="flex items-center gap-2">
          {isFetchingNewEvent && <div className="text-sm text-blue-600">Fetching new events...</div>}
          <button onClick={refetch} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-sm text-gray-600">
          Status: <span className="font-medium">{status}</span>
        </div>
        <div className="text-sm text-gray-600">
          Total Events: <span className="font-medium">{events?.length || 0}</span>
        </div>
      </div>

      {events && events.length > 0 ? (
        <div className="space-y-4">
          {events.map((event, index) => (
            <div
              key={`${event.transactionHash}-${event.logIndex}`}
              className="p-4 border border-gray-200 rounded-lg bg-white shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-lg">Event #{index + 1}</h3>
                <span className="text-sm text-gray-500">Block #{event.blockNumber.toString()}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Transaction Hash:</strong>
                  <div className="font-mono text-xs break-all">{event.transactionHash}</div>
                </div>

                <div>
                  <strong>Block Hash:</strong>
                  <div className="font-mono text-xs break-all">{event.blockHash}</div>
                </div>

                <div>
                  <strong>Log Index:</strong>
                  <div>{event.logIndex}</div>
                </div>

                <div>
                  <strong>Contract Address:</strong>
                  <div className="font-mono text-xs break-all">{event.address}</div>
                </div>
              </div>

              {event.args && Object.keys(event.args).length > 0 && (
                <div className="mt-4">
                  <strong>Event Arguments:</strong>
                  <div className="mt-2 p-3 bg-gray-50 rounded">
                    <pre className="text-xs overflow-x-auto">{JSON.stringify(event.args, null, 2)}</pre>
                  </div>
                </div>
              )}

              {event.blockData && (
                <div className="mt-4">
                  <strong>Block Data:</strong>
                  <div className="mt-2 p-3 bg-gray-50 rounded">
                    <pre className="text-xs overflow-x-auto">{JSON.stringify(event.blockData, null, 2)}</pre>
                  </div>
                </div>
              )}

              {event.transactionData && (
                <div className="mt-4">
                  <strong>Transaction Data:</strong>
                  <div className="mt-2 p-3 bg-gray-50 rounded">
                    <pre className="text-xs overflow-x-auto">{JSON.stringify(event.transactionData, null, 2)}</pre>
                  </div>
                </div>
              )}

              {event.receiptData && (
                <div className="mt-4">
                  <strong>Receipt Data:</strong>
                  <div className="mt-2 p-3 bg-gray-50 rounded">
                    <pre className="text-xs overflow-x-auto">{JSON.stringify(event.receiptData, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No events found. Make sure the contract has events and the event name is correct.
        </div>
      )}
    </div>
  );
};
