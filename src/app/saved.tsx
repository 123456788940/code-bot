'use client';
import React, { useState } from 'react';
import Web3 from 'web3';
import {
  clusterApiUrl,
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
} from '@solana/web3.js';
import bs58 from 'bs58'; // Import bs58 for base58 validation
import '../multiconnectBot.css';

declare global {
  interface Window {
    ethereum: any;
    solana: any;
  }
}

const MultiConnectBot: React.FC = () => {
  const [tradeHistory, setTradeHistory] = useState<
    {
      address: string;
      timestamp: number;
      blockchain: string;
      transactionSignature: string;
    }[]
  >([]);
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [solConnection, setSolConnection] = useState<Connection | null>(null);
  const [ethereumAddress, setEthereumAddress] = useState<string | null>(null);
  const [solanaAddress, setSolanaAddress] = useState<string | null>(null);
  const [tradeStatus, setTradeStatus] = useState<string>('');

  // Function to connect Ethereum wallet
  const connectEthereumWallet = async () => {
    if (!window.ethereum) {
      console.error('MetaMask is not installed.');
      return;
    }
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const accounts = await window.ethereum.request({
        method: 'eth_accounts',
      });
      if (accounts.length > 0) {
        setEthereumAddress(accounts[0]);
        const web3Instance = new Web3(window.ethereum);
        setWeb3(web3Instance);
      }
    } catch (error) {
      console.error('Error connecting to Ethereum wallet:', error);
    }
  };

  // Function to connect Solana wallet using Phantom
  const connectSolanaWalletPhantom = async () => {
    if (!window.solana || !window.solana.isPhantom) {
      console.error('Phantom extension is not installed.');
      return;
    }
    try {
      await window.solana.connect();
      const publicKey = window.solana.publicKey.toString();
      setSolanaAddress(publicKey);
      const connection = new Connection(clusterApiUrl('devnet')); // Use devnet for testing
      setSolConnection(connection);
    } catch (error) {
      console.error('Error connecting to Solana wallet:', error);
    }
  };

  // Function to validate Solana address
  const isValidSolanaAddress = (address: string) => {
    try {
      bs58.decode(address);
      return true;
    } catch (error) {
      return false;
    }
  };

  // Function to handle trade
  const handleTrade = async (address: string) => {
    setTradeStatus('');
    if (web3 && ethereumAddress && Web3.utils.isAddress(address)) {
      try {
        const transaction = {
          from: ethereumAddress,
          to: address,
          value: web3.utils.toWei('1', 'ether'),
        };
        const result = await web3.eth.sendTransaction(transaction);
        setTradeHistory((prevHistory) => [
          ...prevHistory,
          {
            address,
            timestamp: Date.now(),
            blockchain: 'Ethereum',
            transactionSignature: result.transactionHash,
          },
        ]);
        setTradeStatus(
          `Ethereum trade successful! Tx: ${result.transactionHash}`
        );
      } catch (error) {
        console.error('Error sending Ethereum transaction:', error);
        setTradeStatus('Error executing Ethereum trade');
      }
    } else if (
      solConnection &&
      solanaAddress &&
      isValidSolanaAddress(address)
    ) {
      try {
        const fromPubkey = new PublicKey(solanaAddress);
        const toPubkey = new PublicKey(address);
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey,
            toPubkey,
            lamports: 1_000_000_000, // 1 SOL
          })
        );
        transaction.feePayer = fromPubkey;
        const { blockhash } = await solConnection.getRecentBlockhash();
        transaction.recentBlockhash = blockhash;

        console.log('Transaction prepared:', transaction);

        const signedTransaction = await window.solana.signTransaction(
          transaction
        );
        console.log('Transaction signed:', signedTransaction);

        const signature = await solConnection.sendRawTransaction(
          signedTransaction.serialize()
        );
        console.log('Transaction sent, signature:', signature);

        await solConnection.confirmTransaction(signature);
        setTradeHistory((prevHistory) => [
          ...prevHistory,
          {
            address,
            timestamp: Date.now(),
            blockchain: 'Solana',
            transactionSignature: signature,
          },
        ]);
        setTradeStatus(`Solana trade successful! Tx: ${signature}`);
      } catch (error) {
        console.error('Error sending Solana transaction:', error);
        setTradeStatus('Error executing Solana trade');
      }
    } else {
      setTradeStatus(
        'Please connect your wallet first or enter a valid address.'
      );
    }
  };

  return (
    <div className="container">
      <h1 className="title">Multi-Connect Trading Bot</h1>
      <div className="wallets">
        <div className="wallet">
          <h2>Ethereum Wallet (MetaMask)</h2>
          {ethereumAddress ? (
            <p>Connected Address: {ethereumAddress}</p>
          ) : (
            <button
              className="connect-button"
              onClick={connectEthereumWallet}
            >
              Connect
            </button>
          )}
        </div>
        <div className="wallet">
          <h2>Solana Wallet (Phantom)</h2>
          {solanaAddress ? (
            <p>Connected Address: {solanaAddress}</p>
          ) : (
            <button
              className="connect-button"
              onClick={connectSolanaWalletPhantom}
            >
              Connect
            </button>
          )}
        </div>
      </div>
      <div className="trade-form">
        <h2>Trade</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleTrade(e.target.elements.address.value);
          }}
        >
          <input
            type="text"
            name="address"
            placeholder="Enter Ethereum or Solana address"
          />
          <button type="submit">Start Trade</button>
        </form>
        {tradeStatus && <p className="trade-status">{tradeStatus}</p>}
      </div>
      <div className="trade-history">
        <h2>Trade History</h2>
        <ul>
          {tradeHistory.map((trade, index) => (
            <li key={index}>
              {trade.blockchain}: {trade.address} -{' '}
              {new Date(trade.timestamp).toLocaleString()} - Tx:{' '}
              {trade.transactionSignature}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default MultiConnectBot;
