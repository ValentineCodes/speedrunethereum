import { useCallback, useEffect, useRef, useState } from "react";
import { Abi, AbiEvent, ExtractAbiEventNames } from "abitype";
import { ethers } from "ethers";
import { useSelectedNetwork } from "~~/hooks/scaffold-eth";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";
import scaffoldConfig from "~~/scaffold.config";
import { AllowedChainIds } from "~~/utils/scaffold-eth";
import { replacer } from "~~/utils/scaffold-eth/common";
import {
  ContractAbi,
  ContractName,
  UseScaffoldEventHistoryConfig,
  UseScaffoldEventHistoryData,
} from "~~/utils/scaffold-eth/contract";

// Types for the hook
export type UseEventHistoryConfig<
  TContractName extends ContractName,
  TEventName extends ExtractAbiEventNames<ContractAbi<TContractName>>,
  TBlockData extends boolean = false,
  TTransactionData extends boolean = false,
  TReceiptData extends boolean = false,
> = {
  contractName: TContractName;
  eventName: TEventName;
  fromBlock: bigint;
  chainId?: AllowedChainIds;
  filters?: Record<string, any>;
  blockData?: TBlockData;
  transactionData?: TTransactionData;
  receiptData?: TReceiptData;
  watch?: boolean;
  enabled?: boolean;
  pollingInterval?: number;
};

export type UseEventHistoryData<
  TContractName extends ContractName,
  TEventName extends ExtractAbiEventNames<ContractAbi<TContractName>>,
  TBlockData extends boolean = false,
  TTransactionData extends boolean = false,
  TReceiptData extends boolean = false,
> = Array<{
  args: Record<string, any>;
  blockNumber: bigint;
  blockHash: string;
  transactionHash: string;
  logIndex: number;
  address: string;
  topics: string[];
  data: string;
  blockData: TBlockData extends true ? any : null;
  transactionData: TTransactionData extends true ? any : null;
  receiptData: TReceiptData extends true ? any : null;
}>;

export type UseEventHistoryReturn<
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

// Helper function to get provider for a given chain
const getProvider = (chainId: number): ethers.Provider => {
  if (chainId === 31337) {
    // Hardhat network
    return new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  }

  // For other networks, you can extend this with your RPC URLs
  // For now, we'll use a generic approach
  const rpcUrl =
    process.env.NEXT_PUBLIC_RPC_URL || `https://eth-mainnet.g.alchemy.com/v2/${scaffoldConfig.alchemyApiKey}`;
  return new ethers.JsonRpcProvider(rpcUrl);
};

// Helper function to get events using ethers
const getEventsWithEthers = async (
  contractAddress: string,
  abi: Abi,
  eventName: string,
  fromBlock: bigint,
  toBlock?: bigint,
  filters?: Record<string, any>,
  options?: {
    blockData?: boolean;
    transactionData?: boolean;
    receiptData?: boolean;
  },
): Promise<UseEventHistoryData<any, any, any, any, any>> => {
  const provider = getProvider(31337); // Default to hardhat for now
  const contract = new ethers.Contract(contractAddress, abi, provider);

  // Find the event in the ABI
  const eventAbi = abi.find(part => part.type === "event" && part.name === eventName) as AbiEvent;
  if (!eventAbi) {
    throw new Error(`Event ${eventName} not found in contract ABI`);
  }

  // Create filter
  const filter = contract.filters[eventName];
  if (!filter) {
    throw new Error(`Filter for event ${eventName} not found`);
  }

  // Apply filters if provided
  const filterArgs = filters ? Object.values(filters) : [];
  const eventFilter = filter(...filterArgs);

  // Get logs
  const logs = await provider.getLogs({
    address: contractAddress,
    fromBlock: fromBlock,
    toBlock: toBlock || "latest",
    topics: eventFilter.topics,
  });

  // Parse and enrich events
  const events = await Promise.all(
    logs.map(async log => {
      // Parse the log
      const parsedLog = contract.interface.parseLog(log);

      const eventData: any = {
        args: parsedLog?.args || {},
        blockNumber: log.blockNumber,
        blockHash: log.blockHash,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
        address: log.address,
        topics: log.topics,
        data: log.data,
        blockData: null,
        transactionData: null,
        receiptData: null,
      };

      // Add additional data if requested
      if (options?.blockData && log.blockHash) {
        try {
          eventData.blockData = await provider.getBlock(log.blockHash);
        } catch (error) {
          console.warn("Failed to fetch block data:", error);
        }
      }

      if (options?.transactionData && log.transactionHash) {
        try {
          eventData.transactionData = await provider.getTransaction(log.transactionHash);
        } catch (error) {
          console.warn("Failed to fetch transaction data:", error);
        }
      }

      if (options?.receiptData && log.transactionHash) {
        try {
          eventData.receiptData = await provider.getTransactionReceipt(log.transactionHash);
        } catch (error) {
          console.warn("Failed to fetch receipt data:", error);
        }
      }

      return eventData;
    }),
  );

  return events;
};

// Helper function to add indexed args to event (similar to the original)
const addIndexedArgsToEvent = (event: any) => {
  if (event.args && !Array.isArray(event.args)) {
    return { ...event, args: { ...event.args, ...Object.values(event.args) } };
  }
  return event;
};

/**
 * Reads events from a deployed contract using ethers v6
 * @param config - The config settings
 * @param config.contractName - deployed contract name
 * @param config.eventName - name of the event to listen for
 * @param config.fromBlock - the block number to start reading events from
 * @param config.chainId - optional chainId that is configured with the scaffold project
 * @param config.filters - filters to be applied to the event (parameterName: value)
 * @param config.blockData - if set to true it will return the block data for each event (default: false)
 * @param config.transactionData - if set to true it will return the transaction data for each event (default: false)
 * @param config.receiptData - if set to true it will return the receipt data for each event (default: false)
 * @param config.watch - if set to true, the events will be updated every pollingInterval milliseconds (default: false)
 * @param config.enabled - set this to false to disable the hook from running (default: true)
 * @param config.pollingInterval - interval in milliseconds for polling new events (default: 30000)
 */
export const useEventHistory = <
  TContractName extends ContractName,
  TEventName extends ExtractAbiEventNames<ContractAbi<TContractName>>,
  TBlockData extends boolean = false,
  TTransactionData extends boolean = false,
  TReceiptData extends boolean = false,
>({
  contractName,
  eventName,
  fromBlock,
  chainId,
  filters,
  blockData,
  transactionData,
  receiptData,
  watch,
  enabled = true,
  pollingInterval = scaffoldConfig.pollingInterval,
}: UseEventHistoryConfig<TContractName, TEventName, TBlockData, TTransactionData, TReceiptData>): UseEventHistoryReturn<
  TContractName,
  TEventName,
  TBlockData,
  TTransactionData,
  TReceiptData
> => {
  const selectedNetwork = useSelectedNetwork(chainId);
  const [data, setData] = useState<
    UseEventHistoryData<TContractName, TEventName, TBlockData, TTransactionData, TReceiptData> | undefined
  >();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingNewEvent, setIsFetchingNewEvent] = useState(false);
  const [currentBlock, setCurrentBlock] = useState<bigint | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const { data: deployedContractData } = useDeployedContractInfo({
    contractName,
    chainId: selectedNetwork.id as AllowedChainIds,
  });

  const isContractAddressReady = Boolean(deployedContractData?.address);

  // Function to fetch events
  const fetchEvents = useCallback(
    async (fromBlockParam: bigint, toBlock?: bigint) => {
      if (!isContractAddressReady || !deployedContractData?.address || !deployedContractData?.abi) {
        return;
      }

      try {
        setError(null);
        const events = await getEventsWithEthers(
          deployedContractData.address,
          deployedContractData.abi,
          eventName,
          fromBlockParam,
          toBlock,
          filters,
          { blockData, transactionData, receiptData },
        );

        // Process events similar to the original hook
        const processedEvents = events.map(addIndexedArgsToEvent).reverse();

        if (toBlock) {
          // This is a new fetch for new events
          setIsFetchingNewEvent(false);
          setData(prevData => {
            if (!prevData) return processedEvents;
            // Merge and deduplicate events
            const existingHashes = new Set(prevData.map(e => `${e.transactionHash}-${e.logIndex}`));
            const newEvents = processedEvents.filter(e => !existingHashes.has(`${e.transactionHash}-${e.logIndex}`));
            return [...newEvents, ...prevData];
          });
        } else {
          // This is the initial fetch
          setData(processedEvents);
        }

        setStatus("success");
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to fetch events");
        setError(error);
        setStatus("error");
      } finally {
        setIsLoading(false);
      }
    },
    [isContractAddressReady, deployedContractData, eventName, filters, blockData, transactionData, receiptData],
  );

  // Function to refetch events
  const refetch = useCallback(async () => {
    if (!enabled || !isContractAddressReady) return;

    setIsLoading(true);
    await fetchEvents(fromBlock);
  }, [enabled, isContractAddressReady, fetchEvents, fromBlock]);

  // Initial fetch
  useEffect(() => {
    if (!enabled || !isContractAddressReady) return;

    setIsLoading(true);
    fetchEvents(fromBlock);
  }, [enabled, isContractAddressReady, fetchEvents, fromBlock]);

  // Watch for new events
  useEffect(() => {
    if (!watch || !enabled || !isContractAddressReady) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    // Get current block number
    const getCurrentBlock = async () => {
      try {
        const provider = getProvider(selectedNetwork.id);
        const blockNumber = await provider.getBlockNumber();
        setCurrentBlock(blockNumber);
        return blockNumber;
      } catch (error) {
        console.warn("Failed to get current block number:", error);
        return null;
      }
    };

    // Set up polling
    const pollForNewEvents = async () => {
      const currentBlockNumber = await getCurrentBlock();
      if (!currentBlockNumber || currentBlockNumber <= fromBlock) return;

      setIsFetchingNewEvent(true);
      await fetchEvents(fromBlock, currentBlockNumber);
    };

    // Initial poll
    pollForNewEvents();

    // Set up interval
    pollingRef.current = setInterval(pollForNewEvents, pollingInterval);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [watch, enabled, isContractAddressReady, selectedNetwork.id, fromBlock, fetchEvents, pollingInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  return {
    data,
    status,
    error,
    isLoading,
    isFetchingNewEvent,
    refetch,
  };
};
