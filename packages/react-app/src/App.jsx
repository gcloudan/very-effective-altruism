import Portis from "@portis/web3";
import React, { Fragment, useCallback, useEffect, useState } from "react";
import { SyncOutlined } from "@ant-design/icons";
import humanizeDuration from "humanize-duration";
import {
  useBalance,
  useContractLoader,
  useContractReader,
  useGasPrice,
  useOnBlock,
  useUserProviderAndSigner,
} from "eth-hooks";
import { toast, ToastContainer } from 'react-toastify';
import "react-toastify/dist/ReactToastify.css";

import givewell from './images/givewell.png';
import malaria from './images/malaria.png';
import verified from './images/verified.png';
import ukraine from './images/unchain_ukraine.png';

import WalletConnectProvider from "@walletconnect/web3-provider";
import Fortmatic from "fortmatic";
import Authereum from "authereum";
import { useContractConfig } from "./hooks";
import { useEventListener } from "eth-hooks/events/useEventListener";
import { Account, Address, Balance, Events, AddressInput, Contract, Faucet, GasGauge, Header, Ramp, ThemeSwitch } from "./components";
import ReactJson from "react-json-view";

import { useExchangeEthPrice } from "eth-hooks/dapps/dex";
import { Link, Route, Switch, BrowserRouter } from "react-router-dom";
import "./App.css";
import WalletLink from "walletlink";

import { INFURA_ID, NETWORK, NETWORKS, ALCHEMY_KEY } from "./constants";
import externalContracts from "./contracts/external_contracts";
// contracts
import deployedContracts from "./contracts/hardhat_contracts.json";
import { Transactor, Web3ModalSetup } from "./helpers";
import Web3Modal from "web3modal";
import { Home, ExampleUI, Dapp, Hints, Subgraph } from "./views";
import { useStaticJsonRPC } from "./hooks";
import { Alert, Button, Card, Col, Input, List, Menu, Row, DatePicker, Divider, Progress, Slider, Spin } from "antd";
import {
  HomeIcon,
  MenuAlt2Icon,
  XIcon,
  CodeIcon,
  TemplateIcon,
  SparklesIcon,
  CurrencyDollarIcon,
  ShareIcon,
} from '@heroicons/react/outline';

const projectId = "2DDHiA47zFkJXtnxzl2jFkyuaoq";
const projectSecret = "96a91eeafc0a390ab66e6a87f61152aa";
const projectIdAndSecret = `${projectId}:${projectSecret}`;

const { BufferList } = require("bl");
const ipfsAPI = require("ipfs-http-client");

const ipfs = ipfsAPI({
  host: "ipfs.infura.io",
  port: "5001",
  protocol: "https",
  headers: { authorization: `Basic ${Buffer.from(projectIdAndSecret).toString("base64")}` },
});

const { ethers, utils } = require("ethers");

const targetNetwork = NETWORKS.localhost; // <------- select your target frontend network (localhost, rinkeby, xdai, mainnet)

const DEBUG = true;
const NETWORKCHECK = true;
const USE_BURNER_WALLET = true; // toggle burner wallet feature
const USE_NETWORK_SELECTOR = true;

// EXAMPLE STARTING JSON:
const STARTING_JSON = {
  description: "It's actually a bison?",
  external_url: "https://austingriffith.com/portfolio/paintings/", // <-- this can link to a page for the specific file too
  image: "https://austingriffith.com/images/paintings/buffalo.jpg",
  name: "Buffalo",
  attributes: [
    {
      trait_type: "BackgroundColor",
      value: "green",
    },
    {
      trait_type: "Eyes",
      value: "googly",
    },
  ],
};

// helper function to "Get" from IPFS
// you usually go content.toString() after this...
const getFromIPFS = async hashToGet => {
  for await (const file of ipfs.get(hashToGet)) {
    console.log(file.path);
    if (!file.content) continue;
    const content = new BufferList();
    for await (const chunk of file.content) {
      content.append(chunk);
    }
    console.log(content);
    return content;
  }
};

// 🛰 providers
if (DEBUG) console.log("📡 Connecting to Mainnet Ethereum");
// const mainnetProvider = getDefaultProvider("mainnet", { infura: INFURA_ID, etherscan: ETHERSCAN_KEY, quorum: 1 });
// const mainnetProvider = new InfuraProvider("mainnet",INFURA_ID);
//
// attempt to connect to our own scaffold eth rpc and if that fails fall back to infura...
// Using StaticJsonRpcProvider as the chainId won't change see https://github.com/ethers-io/ethers.js/issues/901
const scaffoldEthProvider = navigator.onLine
  ? new ethers.providers.StaticJsonRpcProvider("https://rpc.scaffoldeth.io:48544")
  : null;
const poktMainnetProvider = navigator.onLine
  ? new ethers.providers.StaticJsonRpcProvider(
      "https://eth-mainnet.gateway.pokt.network/v1/lb/611156b4a585a20035148406",
    )
  : null;
const mainnetInfura = navigator.onLine
  ? new ethers.providers.StaticJsonRpcProvider("https://mainnet.infura.io/v3/" + INFURA_ID)
  : null;
// ( ⚠️ Getting "failed to meet quorum" errors? Check your INFURA_ID

// 🏠 Your local provider is usually pointed at your local blockchain
const localProviderUrl = targetNetwork.rpcUrl;
// as you deploy to other networks you can set REACT_APP_PROVIDER=https://dai.poa.network in packages/react-app/.env
const localProviderUrlFromEnv = process.env.REACT_APP_PROVIDER ? process.env.REACT_APP_PROVIDER : localProviderUrl;
if (DEBUG) console.log("🏠 Connecting to provider:", localProviderUrlFromEnv);
const localProvider = new ethers.providers.StaticJsonRpcProvider(localProviderUrlFromEnv);

// 🔭 block explorer URL
const blockExplorer = targetNetwork.blockExplorer;

// Coinbase walletLink init
const walletLink = new WalletLink({
  appName: "coinbase",
});

// WalletLink provider
const walletLinkProvider = walletLink.makeWeb3Provider(`https://mainnet.infura.io/v3/${INFURA_ID}`, 1);

// Portis ID: 6255fb2b-58c8-433b-a2c9-62098c05ddc9
/*
  Web3 modal helps us "connect" external wallets:
*/

const web3Modal = new Web3Modal({
  network: "localhost", // Optional. If using WalletConnect on xDai, change network to "xdai" and add RPC info below for xDai chain.
  cacheProvider: true, // optional
  theme: "light", // optional. Change to "dark" for a dark theme.
  providerOptions: {
    walletconnect: {
      package: WalletConnectProvider, // required
      options: {
        bridge: "https://polygon.bridge.walletconnect.org",
        infuraId: INFURA_ID,
        rpc: {
          1: `https://mainnet.infura.io/v3/${INFURA_ID}`, // mainnet // For more WalletConnect providers: https://docs.walletconnect.org/quick-start/dapps/web3-provider#required
          42: `https://kovan.infura.io/v3/${INFURA_ID}`,
          100: "https://dai.poa.network", // xDai
        },
      },
    },
    portis: {
      display: {
        logo: "https://user-images.githubusercontent.com/9419140/128913641-d025bc0c-e059-42de-a57b-422f196867ce.png",
        name: "Portis",
        description: "Connect to Portis App",
      },
      package: Portis,
      options: {
        id: "6255fb2b-58c8-433b-a2c9-62098c05ddc9",
      },
    },
    fortmatic: {
      package: Fortmatic, // required
      options: {
        key: "pk_live_5A7C91B2FC585A17", // required
      },
    },
    "custom-walletlink": {
      display: {
        logo: "https://play-lh.googleusercontent.com/PjoJoG27miSglVBXoXrxBSLveV6e3EeBPpNY55aiUUBM9Q1RCETKCOqdOkX2ZydqVf0",
        name: "Coinbase",
        description: "Connect to Coinbase Wallet (not Coinbase App)",
      },
      package: walletLinkProvider,
      connector: async (provider, _options) => {
        await provider.enable();
        return provider;
      },
    },
    authereum: {
      package: Authereum, // required
    },
  },
});

function App(props) {
  const mainnetProvider =
    poktMainnetProvider && poktMainnetProvider._isProvider
      ? poktMainnetProvider
      : scaffoldEthProvider && scaffoldEthProvider._network
      ? scaffoldEthProvider
      : mainnetInfura;

  const [injectedProvider, setInjectedProvider] = useState();
  const [address, setAddress] = useState();

  const logoutOfWeb3Modal = async () => {
    await web3Modal.clearCachedProvider();
    if (injectedProvider && injectedProvider.provider && typeof injectedProvider.provider.disconnect == "function") {
      await injectedProvider.provider.disconnect();
    }
    setTimeout(() => {
      window.location.reload();
    }, 1);
  };

  /* 💵 This hook will get the price of ETH from 🦄 Uniswap: */
  const price = useExchangeEthPrice(targetNetwork, mainnetProvider);

  /* 🔥 This hook will get the price of Gas from ⛽️ EtherGasStation */
  const gasPrice = useGasPrice(targetNetwork, "fast");
  // Use your injected provider from 🦊 Metamask or if you don't have it then instantly generate a 🔥 burner wallet.
  const userProviderAndSigner = useUserProviderAndSigner(injectedProvider, localProvider);
  const userSigner = userProviderAndSigner.signer;

  useEffect(() => {
    async function getAddress() {
      if (userSigner) {
        const newAddress = await userSigner.getAddress();
        setAddress(newAddress);
      }
    }
    getAddress();
  }, [userSigner]);

  // You can warn the user if you would like them to be on a specific network
  const localChainId = localProvider && localProvider._network && localProvider._network.chainId;
  const selectedChainId =
    userSigner && userSigner.provider && userSigner.provider._network && userSigner.provider._network.chainId;

  // For more hooks, check out 🔗eth-hooks at: https://www.npmjs.com/package/eth-hooks

  // The transactor wraps transactions and provides notificiations
  const tx = Transactor(userSigner, gasPrice);

  // Faucet Tx can be used to send funds from the faucet
  const faucetTx = Transactor(localProvider, gasPrice);

  // 🏗 scaffold-eth is full of handy hooks like this one to get your balance:
  const yourLocalBalance = useBalance(localProvider, address);

  // Just plug in different 🛰 providers to get your balance on different chains:
  const yourMainnetBalance = useBalance(mainnetProvider, address);

  const contractConfig = useContractConfig();

  // Load in your local 📝 contract and read a value from it:
  const readContracts = useContractLoader(localProvider, contractConfig);

  // If you want to make 🔐 write transactions to your contracts, use the userSigner:
  const writeContracts = useContractLoader(userSigner, contractConfig, localChainId);

  // EXTERNAL CONTRACT EXAMPLE:
  //
  // If you want to bring in the mainnet DAI contract it would look like:
  const mainnetContracts = useContractLoader(mainnetProvider, contractConfig);

  // If you want to call a function on a new block
  useOnBlock(mainnetProvider, () => {
    console.log(`⛓ A new mainnet block is here: ${mainnetProvider._lastBlockNumber}`);
  });

  // Then read your DAI balance like:
  const myMainnetDAIBalance = useContractReader(mainnetContracts, "DAI", "balanceOf", [
    "0x34aA3F359A9D614239015126635CE7732c18fDF3",
  ]);

  const purpose = useContractReader(mainnetContracts, "DAI", "balanceOf", [
    "0x34aA3F359A9D614239015126635CE7732c18fDF3",
  ]);

  // keep track of a variable from the contract in the local React state:
  const balance = useContractReader(readContracts, "YourCollectible", "balanceOf", [address]);
  console.log("🤗 balance:", balance);

    // 📟 Listen for broadcast events
    const transferEvents = useEventListener(readContracts, "YourCollectible", "Transfer", localProvider, 1);
    console.log("📟 Transfer events:", transferEvents);
  //
  // 🧠 This effect will update yourCollectibles by polling when your balance changes
  //
  const yourBalance = balance && balance.toNumber && balance.toNumber();
  const [yourCollectibles, setYourCollectibles] = useState();

  useEffect(() => {
    const updateYourCollectibles = async () => {
      const collectibleUpdate = [];
      for (let tokenIndex = 0; tokenIndex < balance; tokenIndex++) {
        try {
          console.log("GEtting token index", tokenIndex);
          const tokenId = await readContracts.YourCollectible.tokenOfOwnerByIndex(address, tokenIndex);
          console.log("tokenId", tokenId);
          const tokenURI = await readContracts.YourCollectible.tokenURI(tokenId);
          console.log("tokenURI", tokenURI);

          const ipfsHash = tokenURI.replace("https://ipfs.io/ipfs/", "");
          console.log("ipfsHash", ipfsHash);

          const jsonManifestBuffer = await getFromIPFS(ipfsHash);

          try {
            const jsonManifest = JSON.parse(jsonManifestBuffer.toString());
            console.log("jsonManifest", jsonManifest);
            collectibleUpdate.push({ id: tokenId, uri: tokenURI, owner: address, ...jsonManifest });
          } catch (e) {
            console.log(e);
          }
        } catch (e) {
          console.log(e);
        }
      }
      console.log("UPDATING" + collectibleUpdate)
      setYourCollectibles(collectibleUpdate);
    };
    updateYourCollectibles();
  }, [address, yourBalance]);

  //
  // 🧫 DEBUG 👨🏻‍🔬
  //
  useEffect(() => {
    if (
      DEBUG &&
      mainnetProvider &&
      address &&
      selectedChainId &&
      yourLocalBalance &&
      yourMainnetBalance &&
      readContracts &&
      writeContracts &&
      mainnetContracts
    ) {
      console.log("_____________________________________ 🏗 scaffold-eth _____________________________________");
      console.log("🌎 mainnetProvider", mainnetProvider);
      console.log("🏠 localChainId", localChainId);
      console.log("👩‍💼 selected address:", address);
      console.log("🕵🏻‍♂️ selectedChainId:", selectedChainId);
      console.log("💵 yourLocalBalance", yourLocalBalance ? ethers.utils.formatEther(yourLocalBalance) : "...");
      console.log("💵 yourMainnetBalance", yourMainnetBalance ? ethers.utils.formatEther(yourMainnetBalance) : "...");
      console.log("📝 readContracts", readContracts);
      console.log("🌍 DAI contract on mainnet:", mainnetContracts);
      console.log("💵 yourMainnetDAIBalance", myMainnetDAIBalance);
      console.log("🔐 writeContracts", writeContracts);
    }
  }, [
    mainnetProvider,
    address,
    selectedChainId,
    yourLocalBalance,
    yourMainnetBalance,
    readContracts,
    writeContracts,
    mainnetContracts,
    localChainId,
    myMainnetDAIBalance,
  ]);

  let networkDisplay = "";
  if (NETWORKCHECK && localChainId && selectedChainId && localChainId !== selectedChainId) {
    const networkSelected = NETWORK(selectedChainId);
    const networkLocal = NETWORK(localChainId);
    if (selectedChainId === 1337 && localChainId === 31337) {
      networkDisplay = (
        <div style={{ zIndex: 2, position: "absolute", right: 0, top: 60, padding: 16 }}>
          <Alert
            message="⚠️ Wrong Network ID"
            description={
              <div>
                You have <b>chain id 1337</b> for localhost and you need to change it to <b>31337</b> to work with
                HardHat.
                <div>(MetaMask -&gt; Settings -&gt; Networks -&gt; Chain ID -&gt; 31337)</div>
              </div>
            }
            type="error"
            closable={false}
          />
        </div>
      );
    } else {
      networkDisplay = (
        <div style={{ zIndex: 2, position: "absolute", right: 0, top: 60, padding: 16 }}>
          <Alert
            message="⚠️ Wrong Network"
            description={
              <div>
                You have <b>{networkSelected && networkSelected.name}</b> selected and you need to be on{" "}
                <Button
                  onClick={async () => {
                    const ethereum = window.ethereum;
                    const data = [
                      {
                        chainId: "0x" + targetNetwork.chainId.toString(16),
                        chainName: targetNetwork.name,
                        nativeCurrency: targetNetwork.nativeCurrency,
                        rpcUrls: [targetNetwork.rpcUrl],
                        blockExplorerUrls: [targetNetwork.blockExplorer],
                      },
                    ];
                    console.log("data", data);

                    let switchTx;
                    // https://docs.metamask.io/guide/rpc-api.html#other-rpc-methods
                    try {
                      switchTx = await ethereum.request({
                        method: "wallet_switchEthereumChain",
                        params: [{ chainId: data[0].chainId }],
                      });
                    } catch (switchError) {
                      // not checking specific error code, because maybe we're not using MetaMask
                      try {
                        switchTx = await ethereum.request({
                          method: "wallet_addEthereumChain",
                          params: data,
                        });
                      } catch (addError) {
                        // handle "add" error
                      }
                    }

                    if (switchTx) {
                      console.log(switchTx);
                    }
                  }}
                >
                  <b>{networkLocal && networkLocal.name}</b>
                </Button>
              </div>
            }
            type="error"
            closable={false}
          />
        </div>
      );
    }
  } else {
    networkDisplay = (
      <div style={{ zIndex: -1, position: "absolute", right: 154, top: 28, padding: 16, color: targetNetwork.color }}>
        {targetNetwork.name}
      </div>
    );
  }

  const loadWeb3Modal = useCallback(async () => {
    const provider = await web3Modal.connect();
    setInjectedProvider(new ethers.providers.Web3Provider(provider));

    provider.on("chainChanged", chainId => {
      console.log(`chain changed to ${chainId}! updating providers`);
      setInjectedProvider(new ethers.providers.Web3Provider(provider));
    });

    provider.on("accountsChanged", () => {
      console.log(`account changed!`);
      setInjectedProvider(new ethers.providers.Web3Provider(provider));
    });

    // Subscribe to session disconnection
    provider.on("disconnect", (code, reason) => {
      console.log(code, reason);
      logoutOfWeb3Modal();
    });
    // eslint-disable-next-line
  }, [setInjectedProvider]);

  useEffect(() => {
    if (web3Modal.cachedProvider) {
      loadWeb3Modal();
    }
  }, [loadWeb3Modal]);

  const [route, setRoute] = useState();
  useEffect(() => {
    setRoute(window.location.pathname);
  }, [setRoute]);

  let faucetHint = "";
  const faucetAvailable = localProvider && localProvider.connection && targetNetwork.name.indexOf("local") !== -1;

  const [faucetClicked, setFaucetClicked] = useState(false);
  if (
    !faucetClicked &&
    localProvider &&
    localProvider._network &&
    localProvider._network.chainId == 31337 &&
    yourLocalBalance &&
    ethers.utils.formatEther(yourLocalBalance) <= 0
  ) {
    faucetHint = (
      <div style={{ padding: 16 }}>
        <Button
          type="primary"
          onClick={() => {
            faucetTx({
              to: address,
              value: ethers.utils.parseEther("0.01"),
            });
            setFaucetClicked(true);
          }}
        >
          💰 Grab funds from the faucet ⛽️
        </Button>
      </div>
    );
  }

  const [yourJSON, setYourJSON] = useState(STARTING_JSON);
  const [sending, setSending] = useState();
  const [ipfsHash, setIpfsHash] = useState();
  const [ipfsDownHash, setIpfsDownHash] = useState();
  const [downloading, setDownloading] = useState();
  const [ipfsContent, setIpfsContent] = useState();
  const [transferToAddresses, setTransferToAddresses] = useState({});
  const [minting, setMinting] = useState(false);
  const [count, setCount] = useState(1);

  // the json for the nfts
  const json = {
    1: {
      description: "It's actually a bison?",
      external_url: "https://austingriffith.com/portfolio/paintings/", // <-- this can link to a page for the specific file too
      image: "https://austingriffith.com/images/paintings/buffalo.jpg",
      name: "Buffalo",
      attributes: [
        {
          trait_type: "BackgroundColor",
          value: "green",
        },
        {
          trait_type: "Eyes",
          value: "googly",
        },
        {
          trait_type: "Stamina",
          value: 42,
        },
      ],
    },
    2: {
      description: "What is it so worried about?",
      external_url: "https://austingriffith.com/portfolio/paintings/", // <-- this can link to a page for the specific file too
      image: "https://austingriffith.com/images/paintings/zebra.jpg",
      name: "Zebra",
      attributes: [
        {
          trait_type: "BackgroundColor",
          value: "blue",
        },
        {
          trait_type: "Eyes",
          value: "googly",
        },
        {
          trait_type: "Stamina",
          value: 38,
        },
      ],
    },
    3: {
      description: "What a horn!",
      external_url: "https://austingriffith.com/portfolio/paintings/", // <-- this can link to a page for the specific file too
      image: "https://austingriffith.com/images/paintings/rhino.jpg",
      name: "Rhino",
      attributes: [
        {
          trait_type: "BackgroundColor",
          value: "pink",
        },
        {
          trait_type: "Eyes",
          value: "googly",
        },
        {
          trait_type: "Stamina",
          value: 22,
        },
      ],
    },
    4: {
      description: "Is that an underbyte?",
      external_url: "https://austingriffith.com/portfolio/paintings/", // <-- this can link to a page for the specific file too
      image: "https://austingriffith.com/images/paintings/fish.jpg",
      name: "Fish",
      attributes: [
        {
          trait_type: "BackgroundColor",
          value: "blue",
        },
        {
          trait_type: "Eyes",
          value: "googly",
        },
        {
          trait_type: "Stamina",
          value: 15,
        },
      ],
    },
    5: {
      description: "So delicate.",
      external_url: "https://austingriffith.com/portfolio/paintings/", // <-- this can link to a page for the specific file too
      image: "https://austingriffith.com/images/paintings/flamingo.jpg",
      name: "Flamingo",
      attributes: [
        {
          trait_type: "BackgroundColor",
          value: "black",
        },
        {
          trait_type: "Eyes",
          value: "googly",
        },
        {
          trait_type: "Stamina",
          value: 6,
        },
      ],
    },
    6: {
      description: "Raaaar!",
      external_url: "https://austingriffith.com/portfolio/paintings/", // <-- this can link to a page for the specific file too
      image: "https://austingriffith.com/images/paintings/godzilla.jpg",
      name: "Godzilla",
      attributes: [
        {
          trait_type: "BackgroundColor",
          value: "orange",
        },
        {
          trait_type: "Eyes",
          value: "googly",
        },
        {
          trait_type: "Stamina",
          value: 99,
        },
      ],
    },
  };

  const mintItem = async () => {
    // upload to ipfs

    const uploaded = await ipfs.add(JSON.stringify(json[count]));
    setCount(count + 1);
    console.log("Uploaded Hash: ", uploaded);
    const result = tx(
      writeContracts &&
        writeContracts.YourCollectible &&
        writeContracts.YourCollectible.mintItem(address, uploaded.path),
      update => {
        console.log("📡 Transaction Update:", update);
        if (update && (update.status === "confirmed" || update.status === 1)) {
          toast('⏳ pending!', {
            position: "bottom-right",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "light",
            });
          toast('✅ Donation received!', {
            position: "bottom-right",
            autoClose: 5000,
            delay: 2000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "light",
            });
          console.log(" 🍾 Transaction " + update.hash + " finished!");
          console.log(
            " ⛽️ " +
              update.gasUsed +
              "/" +
              (update.gasLimit || update.gas) +
              " @ " +
              parseFloat(update.gasPrice) / 1000000000 +
              " gwei",
          );
        }
      },
    );
  };

  return (
    <div className="App">
      {/* ✏️ Edit the header and change the title to your project name */}

      {networkDisplay}
      <BrowserRouter>
        <Menu style={{ textAlign: "left" }} selectedKeys={[route]} mode="vertical">
          <Menu.Item key="/">
            <Link
              onClick={() => {
                setRoute("/");
              }}
              to="/"
            >
              YourCollectibles
            </Link>
          </Menu.Item>
          <Menu.Item key="/dapp">
            <Link
              onClick={() => {
                setRoute("/dapp");
              }}
              to="/dapp"
            >
              dapp
            </Link>
          </Menu.Item>
          <Menu.Item key="/transfers">
            <Link
              onClick={() => {
                setRoute("/transfers");
              }}
              to="/transfers"
            >
              Transfers
            </Link>
          </Menu.Item>
          <Menu.Item key="/ipfsup">
            <Link
              onClick={() => {
                setRoute("/ipfsup");
              }}
              to="/ipfsup"
            >
              IPFS Upload
            </Link>
          </Menu.Item>
          <Menu.Item key="/ipfsdown">
            <Link
              onClick={() => {
                setRoute("/ipfsdown");
              }}
              to="/ipfsdown"
            >
              IPFS Download
            </Link>
          </Menu.Item>
          <Menu.Item key="/debugcontracts">
            <Link
              onClick={() => {
                setRoute("/debugcontracts");
              }}
              to="/debugcontracts"
            >
              Debug Contracts
            </Link>
          </Menu.Item>
        </Menu>
        <Switch>
          <Route exact path="/">
            <div style={{ width: 640, margin: "auto", marginTop: 32, paddingBottom: 32 }}>
              <Button
                disabled={minting}
                shape="round"
                size="large"
                onClick={() => {
                  mintItem();
                }}
              >
                MINT NFT
              </Button>
            </div>
            <div style={{ width: 640, margin: "auto", marginTop: 32, paddingBottom: 32 }}>
              <List
                bordered
                dataSource={yourCollectibles}
                renderItem={item => {
                  const id = item.id.toNumber();
                  return (
                    <List.Item key={id + "_" + item.uri + "_" + item.owner}>
                      <Card
                        title={
                          <div>
                            <span style={{ fontSize: 16, marginRight: 8 }}>#{id}</span> {item.name}
                          </div>
                        }
                      >
                        <div>
                          <img src={item.image} style={{ maxWidth: 150 }} />
                        </div>
                        <div>{item.description}</div>
                      </Card>

                      <div>
                        owner:{" "}
                        <Address
                          address={item.owner}
                          ensProvider={mainnetProvider}
                          blockExplorer={blockExplorer}
                          fontSize={16}
                        />
                        <AddressInput
                          ensProvider={mainnetProvider}
                          placeholder="transfer to address"
                          value={transferToAddresses[id]}
                          onChange={newValue => {
                            const update = {};
                            update[id] = newValue;
                            setTransferToAddresses({ ...transferToAddresses, ...update });
                          }}
                        />
                        <Button
                          onClick={() => {
                            console.log("writeContracts", writeContracts);
                            tx(writeContracts.YourCollectible.transferFrom(address, transferToAddresses[id], id));
                          }}
                        >
                          Transfer
                        </Button>
                      </div>
                    </List.Item>
                  );
                }}
              />
            </div>
          </Route>

          <Route path="/dapp">

          <>
          {/* walletmodal */}
<ToastContainer
position="bottom-right"
autoClose={5000}
hideProgressBar={false}
newestOnTop={false}
closeOnClick
rtl={false}
pauseOnFocusLoss
draggable
pauseOnHover
theme="light"
/>


{/* hero */}
<div className="relative mx-auto w-full">
      <div className="h-[32rem] w-full py-64 sm:py-28 flex justify-center items-center bg-gradient-to-br bg-[conic-gradient(at_bottom_left,_var(--tw-gradient-stops))] from-purple-800 via-sky-800 to-indigo-500">

        {/* :PROMO */}
        <div className="relative max-w-3xl flex flex-col justify-center items-center text-center">
          {/* ::Title */}
          <h2 className="text-7xl text-white font-bold">Very Effective Altruism</h2>
          {/* ::Text */}
          <p className="mt-3 text-xl text-white">Get rewarded for giving to top community-selected charities with zero added fees.</p>
          {/* ::Button */}
          <a href="#link" className="mt-10 py-2.5 px-6 shadow rounded bg-gray-50 text-sm sm:text-base text-gray-700 font-semibold hover:shadow-lg hover:bg-white hover:text-gray-900">Pledge Now</a>
        </div>
      </div>
    </div>

{/* hero */}

<div className="h-auto w-full py-64 sm:py-28">

      {/* card */}
      <div class="px-72 justify-center flex">
      <section class="flex container p-15 antialiased">
        <article class=" w-1/3 py-6 px-3 transform duration-500 hover:-translate-y-2">
          <div class="bg-white shadow-xl rounded-lg overflow-hidden">
            <div class="bg-cover bg-center h-80 p-4" style={{'backgroundImage': `url(${malaria})`,'height': '250px'}}>
              <div class="flex justify-end">
                <p>256</p>
                <svg class="ml-1 h-6 w-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path
                    d="M12.76 3.76a6 6 0 0 1 8.48 8.48l-8.53 8.54a1 1 0 0 1-1.42 0l-8.53-8.54a6 6 0 0 1 8.48-8.48l.76.75.76-.75zm7.07 7.07a4 4 0 1 0-5.66-5.66l-1.46 1.47a1 1 0 0 1-1.42 0L9.83 5.17a4 4 0 1 0-5.66 5.66L12 18.66l7.83-7.83z">
                  </path>
                </svg>
              </div>
            </div>
            <div class="pl-4 pr-4 pt-4">
            <p class="tracking-wide text-lg font-bold text-gray-900">
                Knitters Against Malaria
              </p>
              <p class="text-base text-gray-700">
                Knitters Against Malaria is a fundraising effort to help raise money for nets through donations to the Against Malaria Foundation, one of the most effective charities. Every $2 finances a net that lasts 3-4 years and saves two people.
              </p>
              <div class="flex">
              <p class="text-lg text-gray-700 font-medium">$54941</p>
              <p class="pl-1 pt-1 text-md text-gray-500">Raised</p>
              </div>
              <div class="flex border-t border-gray-200 text-gray-700">
              <div class="mt-2 flex-1  inline-flex items-center">
<img src={verified} />
              </div>
            </div>
      
            <div class="p-2 flex flex-col justify-center">
            <button onClick={() => {
                  mintItem();
                }} type="button" class="group-hover:opacity-80 transform duration-500 uppercase flex justify-center items-center select-none mt-2 text-white bg-violet-600 hover:bg-violet-600/90 focus:ring-4 focus:outline-none focus:ring-[#F7BE38]/50 font-medium rounded-lg text-white text-sm px-5 py-2.5 text-center inline-flex items-center dark:focus:ring-[#F7BE38]/50 mr-2 mb-2 font-semibold">
  Donate
</button>
</div>
            </div>
          </div>
        </article>


        <article class="w-1/3 py-6 px-3 transform duration-500 hover:-translate-y-2">
          <div class="bg-white shadow-xl rounded-lg overflow-hidden">
            <div class="bg-cover bg-center h-80 p-4" style={{'backgroundImage': `url(${ukraine})`,'height': '250px'}}>
              <div class="flex justify-end">
                <p class="text-white">123</p>
                <svg class="ml-1 h-6 w-6 text-white fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path
                    d="M12.76 3.76a6 6 0 0 1 8.48 8.48l-8.53 8.54a1 1 0 0 1-1.42 0l-8.53-8.54a6 6 0 0 1 8.48-8.48l.76.75.76-.75zm7.07 7.07a4 4 0 1 0-5.66-5.66l-1.46 1.47a1 1 0 0 1-1.42 0L9.83 5.17a4 4 0 1 0-5.66 5.66L12 18.66l7.83-7.83z">
                  </path>
                </svg>
              </div>
            </div>
            <div class="pl-4 pr-4 pt-4">
            <p class="tracking-wide text-lg font-bold text-gray-900">
                Ukraine Fund
              </p>
              <p class="text-base text-gray-700">
              The Blockchain charity fund “Unchain” raises funds for Ukrainians affected by the war. We also promote and protect women’s and children’s rights In Ukraine and globally. We are a Ukrainian charity, entirely funded by supporters.
              </p>
              <div class="flex">
              <p class="text-lg text-gray-700 font-medium">$78092</p>
              <p class="pl-1 pt-1 text-md text-gray-500">Raised</p>
              </div>
              <div class="flex border-t border-gray-200 text-gray-700">
              <div class="mt-2 flex-1  inline-flex items-center">
<img src={verified} />
              </div>
            </div>
            <div class="p-2 flex flex-col justify-center">
            <button type="button" class="shadow-xl uppercase flex justify-center items-center select-none mt-2 text-white bg-violet-600 hover:bg-violet-600/90 focus:ring-4 focus:outline-none focus:ring-[#F7BE38]/50 font-medium rounded-lg text-white text-sm px-5 py-2.5 text-center inline-flex items-center dark:focus:ring-[#F7BE38]/50 mr-2 mb-2 font-semibold">
  Donate
</button>
</div>
            </div>
          </div>
        </article>
        <article class="w-1/3 py-6 px-3 transform duration-500 hover:-translate-y-2">
          <div class="bg-white shadow-xl rounded-lg overflow-hidden">
            <div class="bg-cover bg-center h-80 p-4" style={{'backgroundImage': `url(${givewell})`,'height': '250px'}}>
              <div class="flex justify-end">
              <p>49</p>
                <svg class="ml-1 h-6 w-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path
                    d="M12.76 3.76a6 6 0 0 1 8.48 8.48l-8.53 8.54a1 1 0 0 1-1.42 0l-8.53-8.54a6 6 0 0 1 8.48-8.48l.76.75.76-.75zm7.07 7.07a4 4 0 1 0-5.66-5.66l-1.46 1.47a1 1 0 0 1-1.42 0L9.83 5.17a4 4 0 1 0-5.66 5.66L12 18.66l7.83-7.83z">
                  </path>
                </svg>
              </div>
            </div>
            <div class="pl-4 pr-4 pt-4">
            <p class="tracking-wide text-lg font-bold text-gray-900">
               GiveWell.org
              </p>
              <p class="text-base text-gray-700">
              GiveWell is an independent nonprofit focused on helping people do as much good as possible with their donations. They recommend a short list of top charities that we update annually. All of our research is free and available to the public.
              </p>
              <div class="flex">
              <p class="text-lg text-gray-700 font-medium">$2356</p>
              <p class="pl-1 pt-1 text-md text-gray-500">Raised</p>
              </div>
              <div class="flex border-t border-gray-200 text-gray-700">
              <div class="mt-2 flex-1  inline-flex items-center">
<img src={verified} />
              </div>
            </div>
            <div class="p-2 flex flex-col justify-center">
            <button type="button" class="shadow-xl uppercase flex justify-center items-center select-none mt-2 text-white bg-violet-600 hover:bg-violet-600/90 focus:ring-4 focus:outline-none focus:ring-[#F7BE38]/50 font-medium rounded-lg text-white text-sm px-5 py-2.5 text-center inline-flex items-center dark:focus:ring-[#F7BE38]/50 mr-2 mb-2 font-semibold">
  Donate
</button>
</div></div>
          </div>
        </article>
      </section>
      {/* card */}
      </div>

{/* info */}

<div className="my-24 h-auto w-full py-28 bg-gray-100">
<p className="text-4xl font-normal text-black">How it works</p>
      {/* card */}
      <div class="px-32 m-10 flex">

      <section class="container mx-auto p-5 transform duration-500">
        <article class="bg-white flex flex-nowrap shadow-lg h-36">
            <img class="object-scale-down h-36" src="https://images.unsplash.com/photo-1516750860688-6edafc01087f?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxzZWFyY2h8MTR8fG1vbmtleXxlbnwwfDF8MHx8&auto=format&fit=crop&w=500&q=60" alt="" />
            <div class="px-5 pb-8 pt-4 my-auto">
                <h1 class="text-2xl font-semibold text-gray-800">NFT Rewards</h1>
                <p class="text-base text-black text-bold">
                    Get a free NFT for just making a pledge. Earn higher tier NFTs when you make yearly donations.
                </p>
            </div>
        </article>
    </section>
    <section class="container mx-auto p-5 transform duration-500">
        <article class="bg-white flex flex-nowrap shadow-lg h-36 ">
            <img class="object-scale-down h-36" src="https://images.unsplash.com/photo-1654803291904-79cfb92128ef?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxzZWFyY2h8M3x8dGhvbWFzJTIwamVmZmVyc29uJTIwbWVtb3JpYWx8ZW58MHx8MHx8&auto=format&fit=crop&w=500&q=60" alt="" />
            <div class="px-5 pb-8 pt-4 my-auto">
                <h1 class="text-2xl font-semibold text-gray-800">DAO</h1>
                <p class="text-base text-black text-bold">
                  All NFT owners are invited to join the community DAO to vote for top charities each month.
                </p>
            </div>
        </article>
    </section>
    <section class="container mx-auto p-5 transform duration-500">
        <article class="bg-white flex flex-nowrap shadow-lg h-36 ">
            <img class="object-scale-down h-36" src="https://images.unsplash.com/photo-1638368593117-f87fb4ebeb74?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxzZWFyY2h8NDh8fGhvdGRvZ3xlbnwwfDF8MHx8&auto=format&fit=crop&w=500&q=60" alt="" />
            <div class="px-5 pb-8 pt-4 my-auto">
                <h1 class="text-2xl font-semibold text-gray-800">Partnerships</h1>
                <p class="text-base text-black text-bold">
                    NFT owners will have access to special perks such as discounted stadium tickets, cinema vouchers etc.
                </p>
            </div>
        </article>
    </section>
      </div>
</div>



      <div style={{ border: "1px solid #cccccc", padding: 16, width: 500 }}>



        Your Address:
        <Address address={address} ensProvider={mainnetProvider} fontSize={16} />

        <Divider />

        {/* use utils.formatEther to display a BigNumber: */}
        <h2>Your Balance: {yourLocalBalance ? utils.formatEther(yourLocalBalance) : "..."}</h2>
        <div>OR</div>
        <Balance address={address} provider={localProvider} price={price} />
        <Divider />
        <div>🐳 Example Whale Balance:</div>
        <Balance balance={utils.parseEther("1000")} provider={localProvider} price={price} />
        <Divider />
        {/* use utils.formatEther to display a BigNumber: */}
        <h2>Your Balance: {yourLocalBalance ? utils.formatEther(yourLocalBalance) : "..."}</h2>
        <Divider />
        Your Contract Address:
        <Address
          address={readContracts && readContracts.YourContract ? readContracts.YourContract.address : null}
          ensProvider={mainnetProvider}
          fontSize={16}
        />
        <Divider />
        <div style={{ margin: 8 }}>
          <Button
            onClick={() => {
              /* look how you call setPurpose on your contract: */
              tx(writeContracts.YourContract.setPurpose("🍻 Cheers"));
            }}
          >
            Set Purpose to &quot;🍻 Cheers&quot;
          </Button>
        </div>
        <div style={{ margin: 8 }}>
          <Button
            onClick={() => {
              /*
              you can also just craft a transaction and send it to the tx() transactor
              here we are sending value straight to the contract's address:
            */
              tx({
                to: writeContracts.YourContract.address,
                value: utils.parseEther("0.001"),
              });
              /* this should throw an error about "no fallback nor receive function" until you add it */
            }}
          >
            Send Value
          </Button>
        </div>
        <div style={{ margin: 8 }}>
          <Button
            onClick={() => {
              /* look how we call setPurpose AND send some value along */
              tx(
                writeContracts.YourContract.setPurpose("💵 Paying for this one!", {
                  value: utils.parseEther("0.001"),
                }),
              );
              /* this will fail until you make the setPurpose function payable */
            }}
          >
            Set Purpose With Value
          </Button>
        </div>
        <div style={{ margin: 8 }}>
          <Button
            onClick={() => {
              /* you can also just craft a transaction and send it to the tx() transactor */
              tx({
                to: writeContracts.YourContract.address,
                value: utils.parseEther("0.001"),
                data: writeContracts.YourContract.interface.encodeFunctionData("setPurpose(string)", [
                  "🤓 Whoa so 1337!",
                ]),
              });
              /* this should throw an error about "no fallback nor receive function" until you add it */
            }}
          >
            Another Example
          </Button>
        </div>
      </div>

      {/*
        📑 Maybe display a list of events?
          (uncomment the event and emit line in YourContract.sol! )
      */}
      <Events
        contracts={readContracts}
        contractName="YourContract"
        eventName="SetPurpose"
        localProvider={localProvider}
        mainnetProvider={mainnetProvider}
        startBlock={1}
      />

      <div style={{ width: 600, margin: "auto", marginTop: 32, paddingBottom: 256 }}>


        <Card style={{ marginTop: 32 }}>

          <div style={{ marginTop: 32 }}>
            <Progress percent={50} status="active" />
          </div>

          <div style={{ marginTop: 32 }}>
            <Spin />
          </div>
        </Card>
      </div>
      </div>
      </>



          </Route>

          <Route path="/transfers">
            <div style={{ width: 600, margin: "auto", marginTop: 32, paddingBottom: 32 }}>
              <List
                bordered
                dataSource={transferEvents}
                renderItem={item => {
                  return (
                    <List.Item key={item[0] + "_" + item[1] + "_" + item.blockNumber + "_" + item.args[2].toNumber()}>
                      <span style={{ fontSize: 16, marginRight: 8 }}>#{item.args[2].toNumber()}</span>
                      <Address address={item.args[0]} ensProvider={mainnetProvider} fontSize={16} /> =&gt;
                      <Address address={item.args[1]} ensProvider={mainnetProvider} fontSize={16} />
                    </List.Item>
                  );
                }}
              />
            </div>
          </Route>

          <Route path="/ipfsup">
            <div style={{ paddingTop: 32, width: 740, margin: "auto", textAlign: "left" }}>
              <ReactJson
                style={{ padding: 8 }}
                src={yourJSON}
                theme="pop"
                enableClipboard={false}
                onEdit={(edit, a) => {
                  setYourJSON(edit.updated_src);
                }}
                onAdd={(add, a) => {
                  setYourJSON(add.updated_src);
                }}
                onDelete={(del, a) => {
                  setYourJSON(del.updated_src);
                }}
              />
            </div>

            <Button
              style={{ margin: 8 }}
              loading={sending}
              size="large"
              shape="round"
              type="primary"
              onClick={async () => {
                console.log("UPLOADING...", yourJSON);
                setSending(true);
                setIpfsHash();
                const result = await ipfs.add(JSON.stringify(yourJSON)); // addToIPFS(JSON.stringify(yourJSON))
                if (result && result.path) {
                  setIpfsHash(result.path);
                }
                setSending(false);
                console.log("RESULT:", result);
              }}
            >
              Upload to IPFS
            </Button>

            <div style={{ padding: 16, paddingBottom: 150 }}>{ipfsHash}</div>
          </Route>
          <Route path="/ipfsdown">
            <div style={{ paddingTop: 32, width: 740, margin: "auto" }}>
              <Input
                value={ipfsDownHash}
                placeHolder="IPFS hash (like QmadqNw8zkdrrwdtPFK1pLi8PPxmkQ4pDJXY8ozHtz6tZq)"
                onChange={e => {
                  setIpfsDownHash(e.target.value);
                }}
              />
            </div>
            <Button
              style={{ margin: 8 }}
              loading={sending}
              size="large"
              shape="round"
              type="primary"
              onClick={async () => {
                console.log("DOWNLOADING...", ipfsDownHash);
                setDownloading(true);
                setIpfsContent();
                const result = await getFromIPFS(ipfsDownHash); // addToIPFS(JSON.stringify(yourJSON))
                if (result && result.toString) {
                  setIpfsContent(result.toString());
                }
                setDownloading(false);
              }}
            >
              Download from IPFS
            </Button>

            <pre style={{ padding: 16, width: 500, margin: "auto", paddingBottom: 150 }}>{ipfsContent}</pre>
          </Route>
          <Route path="/debugcontracts">
            <Contract
              name="YourCollectible"
              signer={userSigner}
              provider={localProvider}
              address={address}
              blockExplorer={blockExplorer}
              contractConfig={contractConfig}
            />
          </Route>
        </Switch>
      </BrowserRouter>

      <ThemeSwitch />

      {/* 👨‍💼 Your account is in the top right with a wallet at connect options */}
      <div style={{  position: "fixed", textAlign: "right", right: 5, top: 0, padding: 10 }}>
        <Account
          address={address}
          localProvider={localProvider}
          userSigner={userSigner}
          mainnetProvider={mainnetProvider}
          price={price}
          web3Modal={web3Modal}
          loadWeb3Modal={loadWeb3Modal}
          logoutOfWeb3Modal={logoutOfWeb3Modal}
          blockExplorer={blockExplorer}
        />
        {faucetHint}
      </div>

      {/* 🗺 Extra UI like gas price, eth price, faucet, and support: */}
      <div style={{ position: "fixed", textAlign: "left", left: 0, bottom: 20, padding: 10 }}>
        <Row align="middle" gutter={[4, 4]}>
          <Col span={8}>
            <Ramp price={price} address={address} networks={NETWORKS} />
          </Col>

          <Col span={8} style={{ textAlign: "center", opacity: 0.8 }}>
            <GasGauge gasPrice={gasPrice} />
          </Col>
          <Col span={8} style={{ textAlign: "center", opacity: 1 }}>
            <Button
              onClick={() => {
                window.open("https://t.me/joinchat/KByvmRe5wkR-8F_zz6AjpA");
              }}
              size="large"
              shape="round"
            >
              <span style={{ marginRight: 8 }} role="img" aria-label="support">
                💬
              </span>
              Support
            </Button>
          </Col>
        </Row>

        <Row align="middle" gutter={[4, 4]}>
          <Col span={24}>
            {
              /*  if the local provider has a signer, let's show the faucet:  */
              faucetAvailable ? (
                <Faucet localProvider={localProvider} price={price} ensProvider={mainnetProvider} />
              ) : (
                ""
              )
            }
          </Col>
        </Row>
      </div>
    </div>
  );
}

export default App;
