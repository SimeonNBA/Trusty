import { r as __toESM, t as require_react } from "./react-CoTh1R2n.js";
import { c as NamespaceNotFoundError, d as WalletAlreadyConnectedError, h as require_jsx_runtime, i as MissingRequiredParamError, l as ConnectionInProgressError, m as Storage, o as buildChainId, p as Emitter, r as useTrustConnectContext, s as MissingChainError, t as useConnection, u as NoWalletConnectedError } from "./useConnection-CYhZ-aoN.js";
import { _ as rotlSH, c as clean, f as swap32IfBE, g as rotlBL, h as rotlBH, i as aexists, m as u32, n as Hash, o as anumber, p as toBytes$1, r as abytes, s as aoutput, t as sha256$2, u as createHasher, v as rotlSL, y as split } from "./sha2-B2IR8cKy.js";
//#region node_modules/@trustwallet/connect-core/dist/02-namespace/base.js
var STORAGE_KEY_PREFIX = "trust-connect.namespace";
var NamespaceBase = class {
	constructor({ id }) {
		this.events = new Emitter();
		this.lastConnectedWalletId = new Storage({
			key: `${STORAGE_KEY_PREFIX}.${id}.lastWallet`,
			version: "0.0.0"
		});
	}
	getConnection() {
		return this.connection;
	}
	getWallets() {
		return this.wallets;
	}
	onConnection(cb) {
		return this.events.on("connection", cb);
	}
	onWallets(cb) {
		return this.events.on("wallets", cb);
	}
	setConnection(connection) {
		this.connection = connection;
		this.events.emit("connection", connection);
	}
	addWallets(wallets) {
		this.wallets = [...this.wallets, ...wallets];
		this.events.emit("wallets", this.wallets);
	}
	clearAllListeners() {
		this.registries.forEach((registry) => registry.clearAllListeners());
		this.events.clear();
	}
	saveLastConnectedWalletId(walletId) {
		this.lastConnectedWalletId.set(walletId);
	}
	getLastConnectedWalletId() {
		return this.lastConnectedWalletId.get();
	}
	clearLastConnectedWalletId() {
		this.lastConnectedWalletId.remove();
	}
};
//#endregion
//#region node_modules/@trustwallet/connect-core/dist/02-namespace/engine.js
var NamespaceEngine = class extends NamespaceBase {
	constructor({ registries, id, icon, name, rpcUrls }) {
		super({ id });
		this.connection = {
			status: "disconnected",
			wallet: void 0,
			address: void 0,
			chain: void 0
		};
		this.wallets = [];
		this.id = id;
		this.name = name;
		this.icon = icon;
		this.registries = registries;
		this.rpcUrls = rpcUrls;
		registries.forEach((registry) => {
			registry.onWallets((wallets) => {
				this.reconnect(wallets);
				this.addWallets(wallets);
			});
			const wallets = registry.getWallets();
			this.reconnect(wallets);
			this.addWallets(wallets);
		});
	}
	async connectOrReconnect({ wallet, functionName }) {
		const connection = this.getConnection();
		if (connection.status === "connecting") throw new ConnectionInProgressError();
		if (connection.status === "connected") throw new WalletAlreadyConnectedError(connection.wallet.id);
		this.setConnection({
			status: "connecting",
			wallet,
			address: void 0,
			chain: void 0
		});
		try {
			wallet.__internal.clearAllListeners();
			wallet.__internal.handleOnAddress(this.onAddress.bind(this));
			wallet.__internal.handleOnChain(this.onChain.bind(this));
			wallet.__internal.startListeners();
			const result = await wallet.__internal[functionName]();
			if (result?.address && result?.chain) {
				this.saveLastConnectedWalletId(wallet.id);
				this.setConnection({
					status: "connected",
					wallet,
					address: result.address,
					chain: result.chain
				});
			} else {
				this.internalDisconnect();
				wallet.__internal.clearAllListeners();
			}
		} catch (e) {
			this.internalDisconnect();
			wallet.__internal.clearAllListeners();
			throw e;
		}
	}
	/** cleared localStorage and set connection status to disconnect */
	internalDisconnect() {
		this.clearLastConnectedWalletId();
		this.setConnection({
			status: "disconnected",
			wallet: void 0,
			address: void 0,
			chain: void 0
		});
	}
	async connect(wallet) {
		return this.connectOrReconnect({
			wallet,
			functionName: "connect"
		});
	}
	async reconnect(wallets) {
		if (this.getConnection().status !== "disconnected") return;
		const lastWalletId = this.getLastConnectedWalletId();
		if (!lastWalletId) return;
		const wallet = wallets.find((w) => w.id === lastWalletId);
		if (!wallet) return;
		this.connectOrReconnect({
			wallet,
			functionName: "reconnect"
		});
	}
	disconnect() {
		const connection = this.getConnection();
		if (connection.status === "connected") {
			connection.wallet.__internal.clearAllListeners();
			this.internalDisconnect();
			connection.wallet.__internal.disconnect();
		}
	}
	abortConnect() {
		const connection = this.getConnection();
		if (connection.status === "connecting" && connection.wallet) {
			connection.wallet.__internal.abortConnect();
			connection.wallet.__internal.clearAllListeners();
			this.internalDisconnect();
		}
	}
	onAddress(next) {
		const connection = this.getConnection();
		if (connection.status === "connected") if (!next) {
			connection.wallet.__internal.clearAllListeners();
			this.internalDisconnect();
		} else this.setConnection({
			...connection,
			address: next
		});
	}
	onChain(next) {
		const connection = this.getConnection();
		if (connection.status === "connected") {
			if (!next) throw new MissingChainError(this.id);
			this.setConnection({
				...connection,
				chain: next
			});
		}
	}
};
//#endregion
//#region node_modules/@trustwallet/connect-core/dist/05-wallet/base.js
/**
* A class that represents an individual wallet created by a single Namespace.
* A global Wallet might own more than one Namespace Wallet.
*/
var WalletAdapterBase = class {
	constructor() {
		this.events = new Emitter();
		this.__internal = {
			connect: this.connect.bind(this),
			reconnect: this.reconnect.bind(this),
			disconnect: this.disconnect.bind(this),
			abortConnect: this.abortConnect.bind(this),
			startListeners: this.startListeners.bind(this),
			stopListeners: this.stopListeners.bind(this),
			handleOnCaipSessionEvent: this.handleOnCaipSessionEvent.bind(this),
			handleOnCaipSessionDelete: this.handleOnCaipSessionDelete.bind(this),
			handleOnAddress: this.handleOnAddress.bind(this),
			handleOnChain: this.handleOnChain.bind(this),
			setAddress: this.emitAddress.bind(this),
			setChain: this.emitChain.bind(this),
			clearAllListeners: this.clearAllListeners.bind(this)
		};
	}
	/**
	* Abort any pending connection attempt
	* This should abort the connection process and clean up any resources
	*/
	abortConnect() {
		if (this.abortController) {
			this.abortController.abort();
			this.abortController = void 0;
		}
	}
	handleOnCaipSessionEvent(cb) {
		this.events.on("session_event", cb);
	}
	handleOnCaipSessionDelete(cb) {
		this.events.on("session_delete", cb);
	}
	handleOnAddress(cb) {
		return this.events.on("address", cb);
	}
	handleOnChain(cb) {
		return this.events.on("chain", cb);
	}
	emitCaipSessionEvent(caipSessionEvent) {
		this.events.emit("session_event", caipSessionEvent);
	}
	emitCaipSessionDelete() {
		this.events.emit("session_delete", void 0);
	}
	emitAddress(address) {
		this.events.emit("address", address);
	}
	emitChain(chain) {
		this.events.emit("chain", chain);
	}
	clearAllListeners() {
		this.events.clear();
		this.__internal.stopListeners();
	}
};
//#endregion
//#region node_modules/@trustwallet/connect-core/dist/04-registry/base.js
/**
* Base class for registries that manage wallet discovery for a specific namespace.
*/
var RegistryBase = class {
	constructor() {
		this.events = new Emitter();
	}
	getWallets() {
		return this.wallets;
	}
	onWallets(cb) {
		return this.events.on("wallets", cb);
	}
	addWallet(wallet) {
		this.wallets.push(wallet);
		this.events.emit("wallets", this.wallets);
	}
	setWallets(wallets) {
		this.wallets = wallets;
		this.events.emit("wallets", this.wallets);
	}
	clearAllListeners() {
		this.events.clear();
		this.stopListeners();
	}
};
//#endregion
//#region node_modules/@trustwallet/connect-eip155-core/dist/constants.js
var EIP155_SCOPE = {
	ID: "eip155",
	NAME: "EVM",
	CHAINS: [],
	METHODS: {
		PERSONAL_SIGN: "personal_sign",
		ETH_SIGN_TYPED_DATA: "eth_signTypedData",
		ETH_SIGN_TYPED_DATA_V4: "eth_signTypedData_v4",
		ETH_REQUEST_ACCOUNTS: "eth_requestAccounts",
		ETH_ACCOUNTS: "eth_accounts",
		ETH_CHAIN_ID: "eth_chainId",
		ETH_SEND_TRANSACTION: "eth_sendTransaction",
		ETH_SIGN_TRANSACTION: "eth_signTransaction",
		ETH_SEND_RAW_TRANSACTION: "eth_sendRawTransaction"
	},
	EVENTS: {
		CHAIN_CHANGED: "chainChanged",
		ACCOUNTS_CHANGED: "accountsChanged",
		DISCONNECT: "disconnect"
	}
};
var EIP155_ICON = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOTYiIGhlaWdodD0iOTYiIHZpZXdCb3g9IjAgMCA5NiA5NiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iNDgiIGN5PSI0OCIgcj0iNDgiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik00OCA2NC45NzQxVjgxLjY5MjJMNjguNTc2MiA1Mi43OTk4TDQ4IDY0Ljk3NDFaIiBmaWxsPSIjNDc0RDU3Ii8+CjxwYXRoIGQ9Ik00OCAzOS4xNzY4VjYwLjY5Nkw2OC41NzYyIDQ4LjUyMThMNDggMzkuMTc2OFoiIGZpbGw9IiMwQjBFMTEiLz4KPHBhdGggZD0iTTQ4IDE0LjM5OTlWMzkuMTc3MUw2OC41NzYyIDQ4LjUyMjFMNDggMTQuMzk5OVoiIGZpbGw9IiM0NzRENTciLz4KPHBhdGggZD0iTTQ4IDY0Ljk3NDFWODEuNjkyMkwyNy40MjM4IDUyLjc5OThMNDggNjQuOTc0MVoiIGZpbGw9IiM3NjgwOEYiLz4KPHBhdGggZD0iTTQ4IDM5LjE3NjhWNjAuNjk2TDI3LjQyMzggNDguNTIxOEw0OCAzOS4xNzY4WiIgZmlsbD0iIzFFMjAyNiIvPgo8cGF0aCBkPSJNNDggMTQuMzk5OVYzOS4xNzcxTDI3LjQyMzggNDguNTIyMUw0OCAxNC4zOTk5WiIgZmlsbD0iIzc2ODA4RiIvPgo8L3N2Zz4K";
//#endregion
//#region node_modules/@trustwallet/connect-eip155-core/dist/wallet.js
var { METHODS, EVENTS } = EIP155_SCOPE;
var EIP155Wallet = class extends WalletAdapterBase {
	constructor({ info, provider }) {
		super();
		this.namespaceIds = [EIP155_SCOPE.ID];
		this.type = "namespace";
		this.handleChainId = (chainId) => {
			this.emitChain(chainId ? {
				namespace: this.namespaceIds[0],
				reference: Number(chainId)
			} : void 0);
		};
		this.handleDisconnect = () => {
			this.emitAddress(void 0);
		};
		this.id = info.rdns;
		this.name = info.name;
		this.icon = info.icon;
		this.eip1193Provider = provider;
	}
	async connect() {
		const accounts = await this.eip1193Provider.request({ method: METHODS.ETH_REQUEST_ACCOUNTS });
		if (accounts.length) {
			const chainId = await this.eip1193Provider.request({ method: METHODS.ETH_CHAIN_ID });
			return {
				address: accounts[0],
				chain: {
					namespace: this.namespaceIds[0],
					reference: Number(chainId)
				}
			};
		}
		return {
			address: void 0,
			chain: void 0
		};
	}
	async reconnect() {
		const accounts = await this.eip1193Provider.request({ method: METHODS.ETH_ACCOUNTS });
		if (accounts.length) {
			const chainId = await this.eip1193Provider.request({ method: METHODS.ETH_CHAIN_ID });
			return {
				address: accounts[0],
				chain: {
					namespace: this.namespaceIds[0],
					reference: Number(chainId)
				}
			};
		}
		return {
			address: void 0,
			chain: void 0
		};
	}
	disconnect() {
		this.emitAddress(void 0);
	}
	handleAccounts(accounts) {
		this.emitAddress(accounts[0]);
	}
	startListeners() {
		this.eip1193Provider.on(EVENTS.ACCOUNTS_CHANGED, this.handleAccounts.bind(this));
		this.eip1193Provider.on(EVENTS.CHAIN_CHANGED, this.handleChainId.bind(this));
		this.eip1193Provider.on(EVENTS.DISCONNECT, this.handleDisconnect.bind(this));
	}
	stopListeners() {
		this.eip1193Provider.removeListener(EVENTS.ACCOUNTS_CHANGED, this.handleAccounts.bind(this));
		this.eip1193Provider.removeListener(EVENTS.CHAIN_CHANGED, this.handleChainId.bind(this));
		this.eip1193Provider.removeListener(EVENTS.DISCONNECT, this.handleDisconnect.bind(this));
	}
	async getProvider() {
		return { request: async (args) => {
			return this.eip1193Provider.request({
				method: args.request.method,
				params: args.request.params
			});
		} };
	}
};
//#endregion
//#region node_modules/@trustwallet/connect-eip155-core/dist/registry.js
var EIP155Registry = class extends RegistryBase {
	constructor() {
		super();
		this.wallets = [];
		this.onAnnouncement = (event) => {
			if (this.wallets.find((wallet) => wallet.id === event.detail.info.rdns)) return;
			const newWallet = new EIP155Wallet(event.detail);
			this.setWallets([...this.wallets, newWallet]);
		};
		this.start();
	}
	start() {
		window.addEventListener("eip6963:announceProvider", this.onAnnouncement.bind(this));
		window.dispatchEvent(new Event("eip6963:requestProvider"));
	}
	stopListeners() {
		window.removeEventListener("eip6963:announceProvider", this.onAnnouncement.bind(this));
	}
};
//#endregion
//#region node_modules/@trustwallet/connect-eip155-core/dist/namespace.js
function createEIP155(config) {
	/** Supported chains are added dynamically. */
	const scope = {
		...EIP155_SCOPE,
		CHAINS: Object.values(config.chains).map((chain) => chain.id.toString())
	};
	return { __createNamespace: () => {
		const registry = new EIP155Registry();
		return {
			namespace: new NamespaceEngine({
				registries: [...config.registries ?? [], registry],
				id: scope.ID,
				name: scope.NAME,
				icon: EIP155_ICON,
				rpcUrls: config.rpcUrls
			}),
			scope
		};
	} };
}
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/subscribable.js
var Subscribable = class {
	constructor() {
		this.listeners = /* @__PURE__ */ new Set();
		this.subscribe = this.subscribe.bind(this);
	}
	subscribe(listener) {
		this.listeners.add(listener);
		this.onSubscribe();
		return () => {
			this.listeners.delete(listener);
			this.onUnsubscribe();
		};
	}
	hasListeners() {
		return this.listeners.size > 0;
	}
	onSubscribe() {}
	onUnsubscribe() {}
};
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/focusManager.js
var FocusManager = class extends Subscribable {
	#focused;
	#cleanup;
	#setup;
	constructor() {
		super();
		this.#setup = (onFocus) => {
			if (typeof window !== "undefined" && window.addEventListener) {
				const listener = () => onFocus();
				window.addEventListener("visibilitychange", listener, false);
				return () => {
					window.removeEventListener("visibilitychange", listener);
				};
			}
		};
	}
	onSubscribe() {
		if (!this.#cleanup) this.setEventListener(this.#setup);
	}
	onUnsubscribe() {
		if (!this.hasListeners()) {
			this.#cleanup?.();
			this.#cleanup = void 0;
		}
	}
	setEventListener(setup) {
		this.#setup = setup;
		this.#cleanup?.();
		this.#cleanup = setup((focused) => {
			if (typeof focused === "boolean") this.setFocused(focused);
			else this.onFocus();
		});
	}
	setFocused(focused) {
		if (this.#focused !== focused) {
			this.#focused = focused;
			this.onFocus();
		}
	}
	onFocus() {
		const isFocused = this.isFocused();
		this.listeners.forEach((listener) => {
			listener(isFocused);
		});
	}
	isFocused() {
		if (typeof this.#focused === "boolean") return this.#focused;
		return globalThis.document?.visibilityState !== "hidden";
	}
};
var focusManager = new FocusManager();
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/timeoutManager.js
var defaultTimeoutProvider = {
	setTimeout: (callback, delay) => setTimeout(callback, delay),
	clearTimeout: (timeoutId) => clearTimeout(timeoutId),
	setInterval: (callback, delay) => setInterval(callback, delay),
	clearInterval: (intervalId) => clearInterval(intervalId)
};
var TimeoutManager = class {
	#provider = defaultTimeoutProvider;
	#providerCalled = false;
	setTimeoutProvider(provider) {
		if (this.#providerCalled && provider !== this.#provider) console.error(`[timeoutManager]: Switching provider after calls to previous provider might result in unexpected behavior.`, {
			previous: this.#provider,
			provider
		});
		this.#provider = provider;
		this.#providerCalled = false;
	}
	setTimeout(callback, delay) {
		this.#providerCalled = true;
		return this.#provider.setTimeout(callback, delay);
	}
	clearTimeout(timeoutId) {
		this.#provider.clearTimeout(timeoutId);
	}
	setInterval(callback, delay) {
		this.#providerCalled = true;
		return this.#provider.setInterval(callback, delay);
	}
	clearInterval(intervalId) {
		this.#provider.clearInterval(intervalId);
	}
};
var timeoutManager = new TimeoutManager();
function systemSetTimeoutZero(callback) {
	setTimeout(callback, 0);
}
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/utils.js
var isServer = typeof window === "undefined" || "Deno" in globalThis;
function noop() {}
function isValidTimeout(value) {
	return typeof value === "number" && value >= 0 && value !== Infinity;
}
function timeUntilStale(updatedAt, staleTime) {
	return Math.max(updatedAt + (staleTime || 0) - Date.now(), 0);
}
function resolveStaleTime(staleTime, query) {
	return typeof staleTime === "function" ? staleTime(query) : staleTime;
}
function resolveQueryBoolean(option, query) {
	return typeof option === "function" ? option(query) : option;
}
function hashKey(queryKey) {
	return JSON.stringify(queryKey, (_, val) => isPlainObject(val) ? Object.keys(val).sort().reduce((result, key) => {
		result[key] = val[key];
		return result;
	}, {}) : val);
}
var hasOwn = Object.prototype.hasOwnProperty;
function replaceEqualDeep(a, b, depth = 0) {
	if (a === b) return a;
	if (depth > 500) return b;
	const array = isPlainArray(a) && isPlainArray(b);
	if (!array && !(isPlainObject(a) && isPlainObject(b))) return b;
	const aSize = (array ? a : Object.keys(a)).length;
	const bItems = array ? b : Object.keys(b);
	const bSize = bItems.length;
	const copy = array ? new Array(bSize) : {};
	let equalItems = 0;
	for (let i = 0; i < bSize; i++) {
		const key = array ? i : bItems[i];
		const aItem = a[key];
		const bItem = b[key];
		if (aItem === bItem) {
			copy[key] = aItem;
			if (array ? i < aSize : hasOwn.call(a, key)) equalItems++;
			continue;
		}
		if (aItem === null || bItem === null || typeof aItem !== "object" || typeof bItem !== "object") {
			copy[key] = bItem;
			continue;
		}
		const v = replaceEqualDeep(aItem, bItem, depth + 1);
		copy[key] = v;
		if (v === aItem) equalItems++;
	}
	return aSize === bSize && equalItems === aSize ? a : copy;
}
function shallowEqualObjects(a, b) {
	if (!b || Object.keys(a).length !== Object.keys(b).length) return false;
	for (const key in a) if (a[key] !== b[key]) return false;
	return true;
}
function isPlainArray(value) {
	return Array.isArray(value) && value.length === Object.keys(value).length;
}
function isPlainObject(o) {
	if (!hasObjectPrototype(o)) return false;
	const ctor = o.constructor;
	if (ctor === void 0) return true;
	const prot = ctor.prototype;
	if (!hasObjectPrototype(prot)) return false;
	if (!prot.hasOwnProperty("isPrototypeOf")) return false;
	if (Object.getPrototypeOf(o) !== Object.prototype) return false;
	return true;
}
function hasObjectPrototype(o) {
	return Object.prototype.toString.call(o) === "[object Object]";
}
function replaceData(prevData, data, options) {
	if (typeof options.structuralSharing === "function") return options.structuralSharing(prevData, data);
	else if (options.structuralSharing !== false) {
		try {
			return replaceEqualDeep(prevData, data);
		} catch (error) {
			console.error(`Structural sharing requires data to be JSON serializable. To fix this, turn off structuralSharing or return JSON-serializable data from your queryFn. [${options.queryHash}]: ${error}`);
			throw error;
		}
		return replaceEqualDeep(prevData, data);
	}
	return data;
}
function shouldThrowError(throwOnError, params) {
	if (typeof throwOnError === "function") return throwOnError(...params);
	return !!throwOnError;
}
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/environmentManager.js
var environmentManager = /* @__PURE__ */ (() => {
	let isServerFn = () => isServer;
	return {
		/**
		* Returns whether the current runtime should be treated as a server environment.
		*/
		isServer() {
			return isServerFn();
		},
		/**
		* Overrides the server check globally.
		*/
		setIsServer(isServerValue) {
			isServerFn = isServerValue;
		}
	};
})();
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/thenable.js
function pendingThenable() {
	let resolve;
	let reject;
	const thenable = new Promise((_resolve, _reject) => {
		resolve = _resolve;
		reject = _reject;
	});
	thenable.status = "pending";
	thenable.catch(() => {});
	function finalize(data) {
		Object.assign(thenable, data);
		delete thenable.resolve;
		delete thenable.reject;
	}
	thenable.resolve = (value) => {
		finalize({
			status: "fulfilled",
			value
		});
		resolve(value);
	};
	thenable.reject = (reason) => {
		finalize({
			status: "rejected",
			reason
		});
		reject(reason);
	};
	return thenable;
}
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/notifyManager.js
var defaultScheduler = systemSetTimeoutZero;
function createNotifyManager() {
	let queue = [];
	let transactions = 0;
	let notifyFn = (callback) => {
		callback();
	};
	let batchNotifyFn = (callback) => {
		callback();
	};
	let scheduleFn = defaultScheduler;
	const schedule = (callback) => {
		if (transactions) queue.push(callback);
		else scheduleFn(() => {
			notifyFn(callback);
		});
	};
	const flush = () => {
		const originalQueue = queue;
		queue = [];
		if (originalQueue.length) scheduleFn(() => {
			batchNotifyFn(() => {
				originalQueue.forEach((callback) => {
					notifyFn(callback);
				});
			});
		});
	};
	return {
		batch: (callback) => {
			let result;
			transactions++;
			try {
				result = callback();
			} finally {
				transactions--;
				if (!transactions) flush();
			}
			return result;
		},
		/**
		* All calls to the wrapped function will be batched.
		*/
		batchCalls: (callback) => {
			return (...args) => {
				schedule(() => {
					callback(...args);
				});
			};
		},
		schedule,
		/**
		* Use this method to set a custom notify function.
		* This can be used to for example wrap notifications with `React.act` while running tests.
		*/
		setNotifyFunction: (fn) => {
			notifyFn = fn;
		},
		/**
		* Use this method to set a custom function to batch notifications together into a single tick.
		* By default React Query will use the batch function provided by ReactDOM or React Native.
		*/
		setBatchNotifyFunction: (fn) => {
			batchNotifyFn = fn;
		},
		setScheduler: (fn) => {
			scheduleFn = fn;
		}
	};
}
var notifyManager = createNotifyManager();
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/onlineManager.js
var OnlineManager = class extends Subscribable {
	#online = true;
	#cleanup;
	#setup;
	constructor() {
		super();
		this.#setup = (onOnline) => {
			if (typeof window !== "undefined" && window.addEventListener) {
				const onlineListener = () => onOnline(true);
				const offlineListener = () => onOnline(false);
				window.addEventListener("online", onlineListener, false);
				window.addEventListener("offline", offlineListener, false);
				return () => {
					window.removeEventListener("online", onlineListener);
					window.removeEventListener("offline", offlineListener);
				};
			}
		};
	}
	onSubscribe() {
		if (!this.#cleanup) this.setEventListener(this.#setup);
	}
	onUnsubscribe() {
		if (!this.hasListeners()) {
			this.#cleanup?.();
			this.#cleanup = void 0;
		}
	}
	setEventListener(setup) {
		this.#setup = setup;
		this.#cleanup?.();
		this.#cleanup = setup(this.setOnline.bind(this));
	}
	setOnline(online) {
		if (this.#online !== online) {
			this.#online = online;
			this.listeners.forEach((listener) => {
				listener(online);
			});
		}
	}
	isOnline() {
		return this.#online;
	}
};
var onlineManager = new OnlineManager();
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/retryer.js
function canFetch(networkMode) {
	return (networkMode ?? "online") === "online" ? onlineManager.isOnline() : true;
}
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/query.js
function fetchState(data, options) {
	return {
		fetchFailureCount: 0,
		fetchFailureReason: null,
		fetchStatus: canFetch(options.networkMode) ? "fetching" : "paused",
		...data === void 0 && {
			error: null,
			status: "pending"
		}
	};
}
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/queryObserver.js
var QueryObserver = class extends Subscribable {
	constructor(client, options) {
		super();
		this.options = options;
		this.#client = client;
		this.#selectError = null;
		this.#currentThenable = pendingThenable();
		this.bindMethods();
		this.setOptions(options);
	}
	#client;
	#currentQuery = void 0;
	#currentQueryInitialState = void 0;
	#currentResult = void 0;
	#currentResultState;
	#currentResultOptions;
	#currentThenable;
	#selectError;
	#selectFn;
	#selectResult;
	#lastQueryWithDefinedData;
	#staleTimeoutId;
	#refetchIntervalId;
	#currentRefetchInterval;
	#trackedProps = /* @__PURE__ */ new Set();
	bindMethods() {
		this.refetch = this.refetch.bind(this);
	}
	onSubscribe() {
		if (this.listeners.size === 1) {
			this.#currentQuery.addObserver(this);
			if (shouldFetchOnMount(this.#currentQuery, this.options)) this.#executeFetch();
			else this.updateResult();
			this.#updateTimers();
		}
	}
	onUnsubscribe() {
		if (!this.hasListeners()) this.destroy();
	}
	shouldFetchOnReconnect() {
		return shouldFetchOn(this.#currentQuery, this.options, this.options.refetchOnReconnect);
	}
	shouldFetchOnWindowFocus() {
		return shouldFetchOn(this.#currentQuery, this.options, this.options.refetchOnWindowFocus);
	}
	destroy() {
		this.listeners = /* @__PURE__ */ new Set();
		this.#clearStaleTimeout();
		this.#clearRefetchInterval();
		this.#currentQuery.removeObserver(this);
	}
	setOptions(options) {
		const prevOptions = this.options;
		const prevQuery = this.#currentQuery;
		this.options = this.#client.defaultQueryOptions(options);
		if (this.options.enabled !== void 0 && typeof this.options.enabled !== "boolean" && typeof this.options.enabled !== "function" && typeof resolveQueryBoolean(this.options.enabled, this.#currentQuery) !== "boolean") throw new Error("Expected enabled to be a boolean or a callback that returns a boolean");
		this.#updateQuery();
		this.#currentQuery.setOptions(this.options);
		if (prevOptions._defaulted && !shallowEqualObjects(this.options, prevOptions)) this.#client.getQueryCache().notify({
			type: "observerOptionsUpdated",
			query: this.#currentQuery,
			observer: this
		});
		const mounted = this.hasListeners();
		if (mounted && shouldFetchOptionally(this.#currentQuery, prevQuery, this.options, prevOptions)) this.#executeFetch();
		this.updateResult();
		if (mounted && (this.#currentQuery !== prevQuery || resolveQueryBoolean(this.options.enabled, this.#currentQuery) !== resolveQueryBoolean(prevOptions.enabled, this.#currentQuery) || resolveStaleTime(this.options.staleTime, this.#currentQuery) !== resolveStaleTime(prevOptions.staleTime, this.#currentQuery))) this.#updateStaleTimeout();
		const nextRefetchInterval = this.#computeRefetchInterval();
		if (mounted && (this.#currentQuery !== prevQuery || resolveQueryBoolean(this.options.enabled, this.#currentQuery) !== resolveQueryBoolean(prevOptions.enabled, this.#currentQuery) || nextRefetchInterval !== this.#currentRefetchInterval)) this.#updateRefetchInterval(nextRefetchInterval);
	}
	getOptimisticResult(options) {
		const query = this.#client.getQueryCache().build(this.#client, options);
		const result = this.createResult(query, options);
		if (shouldAssignObserverCurrentProperties(this, result)) {
			this.#currentResult = result;
			this.#currentResultOptions = this.options;
			this.#currentResultState = this.#currentQuery.state;
		}
		return result;
	}
	getCurrentResult() {
		return this.#currentResult;
	}
	trackResult(result, onPropTracked) {
		return new Proxy(result, { get: (target, key) => {
			this.trackProp(key);
			onPropTracked?.(key);
			if (key === "promise") {
				this.trackProp("data");
				if (!this.options.experimental_prefetchInRender && this.#currentThenable.status === "pending") this.#currentThenable.reject(/* @__PURE__ */ new Error("experimental_prefetchInRender feature flag is not enabled"));
			}
			return Reflect.get(target, key);
		} });
	}
	trackProp(key) {
		this.#trackedProps.add(key);
	}
	getCurrentQuery() {
		return this.#currentQuery;
	}
	refetch({ ...options } = {}) {
		return this.fetch({ ...options });
	}
	fetchOptimistic(options) {
		const defaultedOptions = this.#client.defaultQueryOptions(options);
		const query = this.#client.getQueryCache().build(this.#client, defaultedOptions);
		return query.fetch().then(() => this.createResult(query, defaultedOptions));
	}
	fetch(fetchOptions) {
		return this.#executeFetch({
			...fetchOptions,
			cancelRefetch: fetchOptions.cancelRefetch ?? true
		}).then(() => {
			this.updateResult();
			return this.#currentResult;
		});
	}
	#executeFetch(fetchOptions) {
		this.#updateQuery();
		let promise = this.#currentQuery.fetch(this.options, fetchOptions);
		if (!fetchOptions?.throwOnError) promise = promise.catch(noop);
		return promise;
	}
	#updateStaleTimeout() {
		this.#clearStaleTimeout();
		const staleTime = resolveStaleTime(this.options.staleTime, this.#currentQuery);
		if (environmentManager.isServer() || this.#currentResult.isStale || !isValidTimeout(staleTime)) return;
		const timeout = timeUntilStale(this.#currentResult.dataUpdatedAt, staleTime) + 1;
		this.#staleTimeoutId = timeoutManager.setTimeout(() => {
			if (!this.#currentResult.isStale) this.updateResult();
		}, timeout);
	}
	#computeRefetchInterval() {
		return (typeof this.options.refetchInterval === "function" ? this.options.refetchInterval(this.#currentQuery) : this.options.refetchInterval) ?? false;
	}
	#updateRefetchInterval(nextInterval) {
		this.#clearRefetchInterval();
		this.#currentRefetchInterval = nextInterval;
		if (environmentManager.isServer() || resolveQueryBoolean(this.options.enabled, this.#currentQuery) === false || !isValidTimeout(this.#currentRefetchInterval) || this.#currentRefetchInterval === 0) return;
		this.#refetchIntervalId = timeoutManager.setInterval(() => {
			if (this.options.refetchIntervalInBackground || focusManager.isFocused()) this.#executeFetch();
		}, this.#currentRefetchInterval);
	}
	#updateTimers() {
		this.#updateStaleTimeout();
		this.#updateRefetchInterval(this.#computeRefetchInterval());
	}
	#clearStaleTimeout() {
		if (this.#staleTimeoutId !== void 0) {
			timeoutManager.clearTimeout(this.#staleTimeoutId);
			this.#staleTimeoutId = void 0;
		}
	}
	#clearRefetchInterval() {
		if (this.#refetchIntervalId !== void 0) {
			timeoutManager.clearInterval(this.#refetchIntervalId);
			this.#refetchIntervalId = void 0;
		}
	}
	createResult(query, options) {
		const prevQuery = this.#currentQuery;
		const prevOptions = this.options;
		const prevResult = this.#currentResult;
		const prevResultState = this.#currentResultState;
		const prevResultOptions = this.#currentResultOptions;
		const queryInitialState = query !== prevQuery ? query.state : this.#currentQueryInitialState;
		const { state } = query;
		let newState = { ...state };
		let isPlaceholderData = false;
		let data;
		if (options._optimisticResults) {
			const mounted = this.hasListeners();
			const fetchOnMount = !mounted && shouldFetchOnMount(query, options);
			const fetchOptionally = mounted && shouldFetchOptionally(query, prevQuery, options, prevOptions);
			if (fetchOnMount || fetchOptionally) newState = {
				...newState,
				...fetchState(state.data, query.options)
			};
			if (options._optimisticResults === "isRestoring") newState.fetchStatus = "idle";
		}
		let { error, errorUpdatedAt, status } = newState;
		data = newState.data;
		let skipSelect = false;
		if (options.placeholderData !== void 0 && data === void 0 && status === "pending") {
			let placeholderData;
			if (prevResult?.isPlaceholderData && options.placeholderData === prevResultOptions?.placeholderData) {
				placeholderData = prevResult.data;
				skipSelect = true;
			} else placeholderData = typeof options.placeholderData === "function" ? options.placeholderData(this.#lastQueryWithDefinedData?.state.data, this.#lastQueryWithDefinedData) : options.placeholderData;
			if (placeholderData !== void 0) {
				status = "success";
				data = replaceData(prevResult?.data, placeholderData, options);
				isPlaceholderData = true;
			}
		}
		if (options.select && data !== void 0 && !skipSelect) if (prevResult && data === prevResultState?.data && options.select === this.#selectFn) data = this.#selectResult;
		else try {
			this.#selectFn = options.select;
			data = options.select(data);
			data = replaceData(prevResult?.data, data, options);
			this.#selectResult = data;
			this.#selectError = null;
		} catch (selectError) {
			this.#selectError = selectError;
		}
		if (this.#selectError) {
			error = this.#selectError;
			data = this.#selectResult;
			errorUpdatedAt = Date.now();
			status = "error";
		}
		const isFetching = newState.fetchStatus === "fetching";
		const isPending = status === "pending";
		const isError = status === "error";
		const isLoading = isPending && isFetching;
		const hasData = data !== void 0;
		const nextResult = {
			status,
			fetchStatus: newState.fetchStatus,
			isPending,
			isSuccess: status === "success",
			isError,
			isInitialLoading: isLoading,
			isLoading,
			data,
			dataUpdatedAt: newState.dataUpdatedAt,
			error,
			errorUpdatedAt,
			failureCount: newState.fetchFailureCount,
			failureReason: newState.fetchFailureReason,
			errorUpdateCount: newState.errorUpdateCount,
			isFetched: query.isFetched(),
			isFetchedAfterMount: newState.dataUpdateCount > queryInitialState.dataUpdateCount || newState.errorUpdateCount > queryInitialState.errorUpdateCount,
			isFetching,
			isRefetching: isFetching && !isPending,
			isLoadingError: isError && !hasData,
			isPaused: newState.fetchStatus === "paused",
			isPlaceholderData,
			isRefetchError: isError && hasData,
			isStale: isStale(query, options),
			refetch: this.refetch,
			promise: this.#currentThenable,
			isEnabled: resolveQueryBoolean(options.enabled, query) !== false
		};
		if (this.options.experimental_prefetchInRender) {
			const hasResultData = nextResult.data !== void 0;
			const isErrorWithoutData = nextResult.status === "error" && !hasResultData;
			const finalizeThenableIfPossible = (thenable) => {
				if (isErrorWithoutData) thenable.reject(nextResult.error);
				else if (hasResultData) thenable.resolve(nextResult.data);
			};
			const recreateThenable = () => {
				finalizeThenableIfPossible(this.#currentThenable = nextResult.promise = pendingThenable());
			};
			const prevThenable = this.#currentThenable;
			switch (prevThenable.status) {
				case "pending":
					if (query.queryHash === prevQuery.queryHash) finalizeThenableIfPossible(prevThenable);
					break;
				case "fulfilled":
					if (isErrorWithoutData || nextResult.data !== prevThenable.value) recreateThenable();
					break;
				case "rejected":
					if (!isErrorWithoutData || nextResult.error !== prevThenable.reason) recreateThenable();
					break;
			}
		}
		return nextResult;
	}
	updateResult() {
		const prevResult = this.#currentResult;
		const nextResult = this.createResult(this.#currentQuery, this.options);
		this.#currentResultState = this.#currentQuery.state;
		this.#currentResultOptions = this.options;
		if (this.#currentResultState.data !== void 0) this.#lastQueryWithDefinedData = this.#currentQuery;
		if (shallowEqualObjects(nextResult, prevResult)) return;
		this.#currentResult = nextResult;
		const shouldNotifyListeners = () => {
			if (!prevResult) return true;
			const { notifyOnChangeProps } = this.options;
			const notifyOnChangePropsValue = typeof notifyOnChangeProps === "function" ? notifyOnChangeProps() : notifyOnChangeProps;
			if (notifyOnChangePropsValue === "all" || !notifyOnChangePropsValue && !this.#trackedProps.size) return true;
			const includedProps = new Set(notifyOnChangePropsValue ?? this.#trackedProps);
			if (this.options.throwOnError) includedProps.add("error");
			return Object.keys(this.#currentResult).some((key) => {
				const typedKey = key;
				return this.#currentResult[typedKey] !== prevResult[typedKey] && includedProps.has(typedKey);
			});
		};
		this.#notify({ listeners: shouldNotifyListeners() });
	}
	#updateQuery() {
		const query = this.#client.getQueryCache().build(this.#client, this.options);
		if (query === this.#currentQuery) return;
		const prevQuery = this.#currentQuery;
		this.#currentQuery = query;
		this.#currentQueryInitialState = query.state;
		if (this.hasListeners()) {
			prevQuery?.removeObserver(this);
			query.addObserver(this);
		}
	}
	onQueryUpdate() {
		this.updateResult();
		if (this.hasListeners()) this.#updateTimers();
	}
	#notify(notifyOptions) {
		notifyManager.batch(() => {
			if (notifyOptions.listeners) this.listeners.forEach((listener) => {
				listener(this.#currentResult);
			});
			this.#client.getQueryCache().notify({
				query: this.#currentQuery,
				type: "observerResultsUpdated"
			});
		});
	}
};
function shouldLoadOnMount(query, options) {
	return resolveQueryBoolean(options.enabled, query) !== false && query.state.data === void 0 && !(query.state.status === "error" && resolveQueryBoolean(options.retryOnMount, query) === false);
}
function shouldFetchOnMount(query, options) {
	return shouldLoadOnMount(query, options) || query.state.data !== void 0 && shouldFetchOn(query, options, options.refetchOnMount);
}
function shouldFetchOn(query, options, field) {
	if (resolveQueryBoolean(options.enabled, query) !== false && resolveStaleTime(options.staleTime, query) !== "static") {
		const value = typeof field === "function" ? field(query) : field;
		return value === "always" || value !== false && isStale(query, options);
	}
	return false;
}
function shouldFetchOptionally(query, prevQuery, options, prevOptions) {
	return (query !== prevQuery || resolveQueryBoolean(prevOptions.enabled, query) === false) && (!options.suspense || query.state.status !== "error") && isStale(query, options);
}
function isStale(query, options) {
	return resolveQueryBoolean(options.enabled, query) !== false && query.isStaleByTime(resolveStaleTime(options.staleTime, query));
}
function shouldAssignObserverCurrentProperties(observer, optimisticResult) {
	if (!shallowEqualObjects(observer.getCurrentResult(), optimisticResult)) return true;
	return false;
}
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/mutation.js
function getDefaultState() {
	return {
		context: void 0,
		data: void 0,
		error: null,
		failureCount: 0,
		failureReason: null,
		isPaused: false,
		status: "idle",
		variables: void 0,
		submittedAt: 0
	};
}
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/mutationObserver.js
var MutationObserver = class extends Subscribable {
	#client;
	#currentResult = void 0;
	#currentMutation;
	#mutateOptions;
	constructor(client, options) {
		super();
		this.#client = client;
		this.setOptions(options);
		this.bindMethods();
		this.#updateResult();
	}
	bindMethods() {
		this.mutate = this.mutate.bind(this);
		this.reset = this.reset.bind(this);
	}
	setOptions(options) {
		const prevOptions = this.options;
		this.options = this.#client.defaultMutationOptions(options);
		if (!shallowEqualObjects(this.options, prevOptions)) this.#client.getMutationCache().notify({
			type: "observerOptionsUpdated",
			mutation: this.#currentMutation,
			observer: this
		});
		if (prevOptions?.mutationKey && this.options.mutationKey && hashKey(prevOptions.mutationKey) !== hashKey(this.options.mutationKey)) this.reset();
		else if (this.#currentMutation?.state.status === "pending") this.#currentMutation.setOptions(this.options);
	}
	onUnsubscribe() {
		if (!this.hasListeners()) this.#currentMutation?.removeObserver(this);
	}
	onMutationUpdate(action) {
		this.#updateResult();
		this.#notify(action);
	}
	getCurrentResult() {
		return this.#currentResult;
	}
	reset() {
		this.#currentMutation?.removeObserver(this);
		this.#currentMutation = void 0;
		this.#updateResult();
		this.#notify();
	}
	mutate(variables, options) {
		this.#mutateOptions = options;
		this.#currentMutation?.removeObserver(this);
		this.#currentMutation = this.#client.getMutationCache().build(this.#client, this.options);
		this.#currentMutation.addObserver(this);
		return this.#currentMutation.execute(variables);
	}
	#updateResult() {
		const state = this.#currentMutation?.state ?? getDefaultState();
		this.#currentResult = {
			...state,
			isPending: state.status === "pending",
			isSuccess: state.status === "success",
			isError: state.status === "error",
			isIdle: state.status === "idle",
			mutate: this.mutate,
			reset: this.reset
		};
	}
	#notify(action) {
		notifyManager.batch(() => {
			if (this.#mutateOptions && this.hasListeners()) {
				const variables = this.#currentResult.variables;
				const onMutateResult = this.#currentResult.context;
				const context = {
					client: this.#client,
					meta: this.options.meta,
					mutationKey: this.options.mutationKey
				};
				if (action?.type === "success") {
					try {
						this.#mutateOptions.onSuccess?.(action.data, variables, onMutateResult, context);
					} catch (e) {
						Promise.reject(e);
					}
					try {
						this.#mutateOptions.onSettled?.(action.data, null, variables, onMutateResult, context);
					} catch (e) {
						Promise.reject(e);
					}
				} else if (action?.type === "error") {
					try {
						this.#mutateOptions.onError?.(action.error, variables, onMutateResult, context);
					} catch (e) {
						Promise.reject(e);
					}
					try {
						this.#mutateOptions.onSettled?.(void 0, action.error, variables, onMutateResult, context);
					} catch (e) {
						Promise.reject(e);
					}
				}
			}
			this.listeners.forEach((listener) => {
				listener(this.#currentResult);
			});
		});
	}
};
//#endregion
//#region node_modules/@tanstack/react-query/build/modern/QueryClientProvider.js
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
require_jsx_runtime();
var QueryClientContext = import_react.createContext(void 0);
var useQueryClient = (queryClient) => {
	const client = import_react.useContext(QueryClientContext);
	if (queryClient) return queryClient;
	if (!client) throw new Error("No QueryClient set, use QueryClientProvider to set one");
	return client;
};
//#endregion
//#region node_modules/@tanstack/react-query/build/modern/IsRestoringProvider.js
var IsRestoringContext = import_react.createContext(false);
var useIsRestoring = () => import_react.useContext(IsRestoringContext);
IsRestoringContext.Provider;
//#endregion
//#region node_modules/@tanstack/react-query/build/modern/QueryErrorResetBoundary.js
function createValue() {
	let isReset = false;
	return {
		clearReset: () => {
			isReset = false;
		},
		reset: () => {
			isReset = true;
		},
		isReset: () => {
			return isReset;
		}
	};
}
var QueryErrorResetBoundaryContext = import_react.createContext(createValue());
var useQueryErrorResetBoundary = () => import_react.useContext(QueryErrorResetBoundaryContext);
//#endregion
//#region node_modules/@tanstack/react-query/build/modern/errorBoundaryUtils.js
var ensurePreventErrorBoundaryRetry = (options, errorResetBoundary, query) => {
	const throwOnError = query?.state.error && typeof options.throwOnError === "function" ? shouldThrowError(options.throwOnError, [query.state.error, query]) : options.throwOnError;
	if (options.suspense || options.experimental_prefetchInRender || throwOnError) {
		if (!errorResetBoundary.isReset()) options.retryOnMount = false;
	}
};
var useClearResetErrorBoundary = (errorResetBoundary) => {
	import_react.useEffect(() => {
		errorResetBoundary.clearReset();
	}, [errorResetBoundary]);
};
var getHasError = ({ result, errorResetBoundary, throwOnError, query, suspense }) => {
	return result.isError && !errorResetBoundary.isReset() && !result.isFetching && query && (suspense && result.data === void 0 || shouldThrowError(throwOnError, [result.error, query]));
};
//#endregion
//#region node_modules/@tanstack/react-query/build/modern/suspense.js
var ensureSuspenseTimers = (defaultedOptions) => {
	if (defaultedOptions.suspense) {
		const MIN_SUSPENSE_TIME_MS = 1e3;
		const clamp = (value) => value === "static" ? value : Math.max(value ?? MIN_SUSPENSE_TIME_MS, MIN_SUSPENSE_TIME_MS);
		const originalStaleTime = defaultedOptions.staleTime;
		defaultedOptions.staleTime = typeof originalStaleTime === "function" ? (...args) => clamp(originalStaleTime(...args)) : clamp(originalStaleTime);
		if (typeof defaultedOptions.gcTime === "number") defaultedOptions.gcTime = Math.max(defaultedOptions.gcTime, MIN_SUSPENSE_TIME_MS);
	}
};
var willFetch = (result, isRestoring) => result.isLoading && result.isFetching && !isRestoring;
var shouldSuspend = (defaultedOptions, result) => defaultedOptions?.suspense && result.isPending;
var fetchOptimistic = (defaultedOptions, observer, errorResetBoundary) => observer.fetchOptimistic(defaultedOptions).catch(() => {
	errorResetBoundary.clearReset();
});
//#endregion
//#region node_modules/@tanstack/react-query/build/modern/useBaseQuery.js
function useBaseQuery(options, Observer, queryClient) {
	if (typeof options !== "object" || Array.isArray(options)) throw new Error("Bad argument type. Starting with v5, only the \"Object\" form is allowed when calling query related functions. Please use the error stack to find the culprit call. More info here: https://tanstack.com/query/latest/docs/react/guides/migrating-to-v5#supports-a-single-signature-one-object");
	const isRestoring = useIsRestoring();
	const errorResetBoundary = useQueryErrorResetBoundary();
	const client = useQueryClient(queryClient);
	const defaultedOptions = client.defaultQueryOptions(options);
	client.getDefaultOptions().queries?._experimental_beforeQuery?.(defaultedOptions);
	const query = client.getQueryCache().get(defaultedOptions.queryHash);
	if (!defaultedOptions.queryFn) console.error(`[${defaultedOptions.queryHash}]: No queryFn was passed as an option, and no default queryFn was found. The queryFn parameter is only optional when using a default queryFn. More info here: https://tanstack.com/query/latest/docs/framework/react/guides/default-query-function`);
	const subscribed = options.subscribed !== false;
	defaultedOptions._optimisticResults = isRestoring ? "isRestoring" : subscribed ? "optimistic" : void 0;
	ensureSuspenseTimers(defaultedOptions);
	ensurePreventErrorBoundaryRetry(defaultedOptions, errorResetBoundary, query);
	useClearResetErrorBoundary(errorResetBoundary);
	const isNewCacheEntry = !client.getQueryCache().get(defaultedOptions.queryHash);
	const [observer] = import_react.useState(() => new Observer(client, defaultedOptions));
	const result = observer.getOptimisticResult(defaultedOptions);
	const shouldSubscribe = !isRestoring && subscribed;
	import_react.useSyncExternalStore(import_react.useCallback((onStoreChange) => {
		const unsubscribe = shouldSubscribe ? observer.subscribe(notifyManager.batchCalls(onStoreChange)) : noop;
		observer.updateResult();
		return unsubscribe;
	}, [observer, shouldSubscribe]), () => observer.getCurrentResult(), () => observer.getCurrentResult());
	import_react.useEffect(() => {
		observer.setOptions(defaultedOptions);
	}, [defaultedOptions, observer]);
	if (shouldSuspend(defaultedOptions, result)) throw fetchOptimistic(defaultedOptions, observer, errorResetBoundary);
	if (getHasError({
		result,
		errorResetBoundary,
		throwOnError: defaultedOptions.throwOnError,
		query,
		suspense: defaultedOptions.suspense
	})) throw result.error;
	client.getDefaultOptions().queries?._experimental_afterQuery?.(defaultedOptions, result);
	if (defaultedOptions.experimental_prefetchInRender && !environmentManager.isServer() && willFetch(result, isRestoring)) (isNewCacheEntry ? fetchOptimistic(defaultedOptions, observer, errorResetBoundary) : query?.promise)?.catch(noop).finally(() => {
		observer.updateResult();
	});
	return !defaultedOptions.notifyOnChangeProps ? observer.trackResult(result) : result;
}
//#endregion
//#region node_modules/@tanstack/react-query/build/modern/useQuery.js
function useQuery(options, queryClient) {
	return useBaseQuery(options, QueryObserver, queryClient);
}
//#endregion
//#region node_modules/@tanstack/react-query/build/modern/useMutation.js
function useMutation(options, queryClient) {
	const client = useQueryClient(queryClient);
	const [observer] = import_react.useState(() => new MutationObserver(client, options));
	import_react.useEffect(() => {
		observer.setOptions(options);
	}, [observer, options]);
	const result = import_react.useSyncExternalStore(import_react.useCallback((onStoreChange) => observer.subscribe(notifyManager.batchCalls(onStoreChange)), [observer]), () => observer.getCurrentResult(), () => observer.getCurrentResult());
	const mutate = import_react.useCallback((variables, mutateOptions) => {
		observer.mutate(variables, mutateOptions).catch(noop);
	}, [observer]);
	if (result.error && shouldThrowError(observer.options.throwOnError, [result.error])) throw result.error;
	return {
		...result,
		mutate,
		mutateAsync: result.mutate
	};
}
//#endregion
//#region node_modules/viem/node_modules/abitype/dist/esm/regex.js
function execTyped(regex, string) {
	return regex.exec(string)?.groups;
}
//#endregion
//#region node_modules/viem/node_modules/abitype/dist/esm/human-readable/formatAbiParameter.js
var tupleRegex = /^tuple(?<array>(\[(\d*)\])*)$/;
/**
* Formats {@link AbiParameter} to human-readable ABI parameter.
*
* @param abiParameter - ABI parameter
* @returns Human-readable ABI parameter
*
* @example
* const result = formatAbiParameter({ type: 'address', name: 'from' })
* //    ^? const result: 'address from'
*/
function formatAbiParameter(abiParameter) {
	let type = abiParameter.type;
	if (tupleRegex.test(abiParameter.type) && "components" in abiParameter) {
		type = "(";
		const length = abiParameter.components.length;
		for (let i = 0; i < length; i++) {
			const component = abiParameter.components[i];
			type += formatAbiParameter(component);
			if (i < length - 1) type += ", ";
		}
		const result = execTyped(tupleRegex, abiParameter.type);
		type += `)${result?.array || ""}`;
		return formatAbiParameter({
			...abiParameter,
			type
		});
	}
	if ("indexed" in abiParameter && abiParameter.indexed) type = `${type} indexed`;
	if (abiParameter.name) return `${type} ${abiParameter.name}`;
	return type;
}
//#endregion
//#region node_modules/viem/node_modules/abitype/dist/esm/human-readable/formatAbiParameters.js
/**
* Formats {@link AbiParameter}s to human-readable ABI parameters.
*
* @param abiParameters - ABI parameters
* @returns Human-readable ABI parameters
*
* @example
* const result = formatAbiParameters([
*   //  ^? const result: 'address from, uint256 tokenId'
*   { type: 'address', name: 'from' },
*   { type: 'uint256', name: 'tokenId' },
* ])
*/
function formatAbiParameters(abiParameters) {
	let params = "";
	const length = abiParameters.length;
	for (let i = 0; i < length; i++) {
		const abiParameter = abiParameters[i];
		params += formatAbiParameter(abiParameter);
		if (i !== length - 1) params += ", ";
	}
	return params;
}
//#endregion
//#region node_modules/viem/node_modules/abitype/dist/esm/human-readable/formatAbiItem.js
/**
* Formats ABI item (e.g. error, event, function) into human-readable ABI item
*
* @param abiItem - ABI item
* @returns Human-readable ABI item
*/
function formatAbiItem$1(abiItem) {
	if (abiItem.type === "function") return `function ${abiItem.name}(${formatAbiParameters(abiItem.inputs)})${abiItem.stateMutability && abiItem.stateMutability !== "nonpayable" ? ` ${abiItem.stateMutability}` : ""}${abiItem.outputs?.length ? ` returns (${formatAbiParameters(abiItem.outputs)})` : ""}`;
	if (abiItem.type === "event") return `event ${abiItem.name}(${formatAbiParameters(abiItem.inputs)})`;
	if (abiItem.type === "error") return `error ${abiItem.name}(${formatAbiParameters(abiItem.inputs)})`;
	if (abiItem.type === "constructor") return `constructor(${formatAbiParameters(abiItem.inputs)})${abiItem.stateMutability === "payable" ? " payable" : ""}`;
	if (abiItem.type === "fallback") return `fallback() external${abiItem.stateMutability === "payable" ? " payable" : ""}`;
	return "receive() external payable";
}
//#endregion
//#region node_modules/viem/_esm/utils/getAction.js
/**
* Retrieves and returns an action from the client (if exists), and falls
* back to the tree-shakable action.
*
* Useful for extracting overridden actions from a client (ie. if a consumer
* wants to override the `sendTransaction` implementation).
*/
function getAction(client, actionFn, name) {
	const action_implicit = client[actionFn.name];
	if (typeof action_implicit === "function") return action_implicit;
	const action_explicit = client[name];
	if (typeof action_explicit === "function") return action_explicit;
	return (params) => actionFn(client, params);
}
//#endregion
//#region node_modules/viem/_esm/utils/abi/formatAbiItem.js
function formatAbiItem(abiItem, { includeName = false } = {}) {
	if (abiItem.type !== "function" && abiItem.type !== "event" && abiItem.type !== "error") throw new InvalidDefinitionTypeError(abiItem.type);
	return `${abiItem.name}(${formatAbiParams(abiItem.inputs, { includeName })})`;
}
function formatAbiParams(params, { includeName = false } = {}) {
	if (!params) return "";
	return params.map((param) => formatAbiParam(param, { includeName })).join(includeName ? ", " : ",");
}
function formatAbiParam(param, { includeName }) {
	if (param.type.startsWith("tuple")) return `(${formatAbiParams(param.components, { includeName })})${param.type.slice(5)}`;
	return param.type + (includeName && param.name ? ` ${param.name}` : "");
}
//#endregion
//#region node_modules/viem/_esm/utils/data/isHex.js
function isHex(value, { strict = true } = {}) {
	if (!value) return false;
	if (typeof value !== "string") return false;
	return strict ? /^0x[0-9a-fA-F]*$/.test(value) : value.startsWith("0x");
}
//#endregion
//#region node_modules/viem/_esm/utils/data/size.js
/**
* @description Retrieves the size of the value (in bytes).
*
* @param value The value (hex or byte array) to retrieve the size of.
* @returns The size of the value (in bytes).
*/
function size$1(value) {
	if (isHex(value, { strict: false })) return Math.ceil((value.length - 2) / 2);
	return value.length;
}
//#endregion
//#region node_modules/viem/_esm/errors/version.js
var version = "2.51.3";
//#endregion
//#region node_modules/viem/_esm/errors/base.js
var errorConfig = {
	getDocsUrl: ({ docsBaseUrl, docsPath = "", docsSlug }) => docsPath ? `${docsBaseUrl ?? "https://viem.sh"}${docsPath}${docsSlug ? `#${docsSlug}` : ""}` : void 0,
	version: `viem@${version}`
};
var BaseError = class BaseError extends Error {
	constructor(shortMessage, args = {}) {
		const details = (() => {
			if (args.cause instanceof BaseError) return args.cause.details;
			if (args.cause?.message) return args.cause.message;
			return args.details;
		})();
		const docsPath = (() => {
			if (args.cause instanceof BaseError) return args.cause.docsPath || args.docsPath;
			return args.docsPath;
		})();
		const docsUrl = errorConfig.getDocsUrl?.({
			...args,
			docsPath
		});
		const message = [
			shortMessage || "An error occurred.",
			"",
			...args.metaMessages ? [...args.metaMessages, ""] : [],
			...docsUrl ? [`Docs: ${docsUrl}`] : [],
			...details ? [`Details: ${details}`] : [],
			...errorConfig.version ? [`Version: ${errorConfig.version}`] : []
		].join("\n");
		super(message, args.cause ? { cause: args.cause } : void 0);
		Object.defineProperty(this, "details", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "docsPath", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "metaMessages", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "shortMessage", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "version", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "name", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: "BaseError"
		});
		this.details = details;
		this.docsPath = docsPath;
		this.metaMessages = args.metaMessages;
		this.name = args.name ?? this.name;
		this.shortMessage = shortMessage;
		this.version = version;
	}
	walk(fn) {
		return walk(this, fn);
	}
};
function walk(err, fn) {
	if (fn?.(err)) return err;
	if (err && typeof err === "object" && "cause" in err && err.cause !== void 0) return walk(err.cause, fn);
	return fn ? null : err;
}
//#endregion
//#region node_modules/viem/_esm/errors/abi.js
var AbiDecodingDataSizeTooSmallError = class extends BaseError {
	constructor({ data, params, size }) {
		super([`Data size of ${size} bytes is too small for given parameters.`].join("\n"), {
			metaMessages: [`Params: (${formatAbiParams(params, { includeName: true })})`, `Data:   ${data} (${size} bytes)`],
			name: "AbiDecodingDataSizeTooSmallError"
		});
		Object.defineProperty(this, "data", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "params", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "size", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		this.data = data;
		this.params = params;
		this.size = size;
	}
};
var AbiDecodingZeroDataError = class extends BaseError {
	constructor({ cause } = {}) {
		super("Cannot decode zero data (\"0x\") with ABI parameters.", {
			name: "AbiDecodingZeroDataError",
			cause
		});
	}
};
var AbiEncodingArrayLengthMismatchError = class extends BaseError {
	constructor({ expectedLength, givenLength, type }) {
		super([
			`ABI encoding array length mismatch for type ${type}.`,
			`Expected length: ${expectedLength}`,
			`Given length: ${givenLength}`
		].join("\n"), { name: "AbiEncodingArrayLengthMismatchError" });
	}
};
var AbiEncodingBytesSizeMismatchError = class extends BaseError {
	constructor({ expectedSize, value }) {
		super(`Size of bytes "${value}" (bytes${size$1(value)}) does not match expected size (bytes${expectedSize}).`, { name: "AbiEncodingBytesSizeMismatchError" });
	}
};
var AbiEncodingLengthMismatchError = class extends BaseError {
	constructor({ expectedLength, givenLength }) {
		super([
			"ABI encoding params/values length mismatch.",
			`Expected length (params): ${expectedLength}`,
			`Given length (values): ${givenLength}`
		].join("\n"), { name: "AbiEncodingLengthMismatchError" });
	}
};
var AbiErrorSignatureNotFoundError = class extends BaseError {
	constructor(signature, { docsPath, cause }) {
		super([
			`Encoded error signature "${signature}" not found on ABI.`,
			"Make sure you are using the correct ABI and that the error exists on it.",
			`You can look up the decoded signature here: https://4byte.sourcify.dev/?q=${signature}.`
		].join("\n"), {
			docsPath,
			name: "AbiErrorSignatureNotFoundError",
			cause
		});
		Object.defineProperty(this, "signature", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		this.signature = signature;
	}
};
var AbiFunctionNotFoundError = class extends BaseError {
	constructor(functionName, { docsPath } = {}) {
		super([`Function ${functionName ? `"${functionName}" ` : ""}not found on ABI.`, "Make sure you are using the correct ABI and that the function exists on it."].join("\n"), {
			docsPath,
			name: "AbiFunctionNotFoundError"
		});
	}
};
var AbiItemAmbiguityError = class extends BaseError {
	constructor(x, y) {
		super("Found ambiguous types in overloaded ABI items.", {
			metaMessages: [
				`\`${x.type}\` in \`${formatAbiItem(x.abiItem)}\`, and`,
				`\`${y.type}\` in \`${formatAbiItem(y.abiItem)}\``,
				"",
				"These types encode differently and cannot be distinguished at runtime.",
				"Remove one of the ambiguous items in the ABI."
			],
			name: "AbiItemAmbiguityError"
		});
	}
};
var InvalidAbiEncodingTypeError = class extends BaseError {
	constructor(type, { docsPath }) {
		super([`Type "${type}" is not a valid encoding type.`, "Please provide a valid ABI type."].join("\n"), {
			docsPath,
			name: "InvalidAbiEncodingType"
		});
	}
};
var InvalidAbiDecodingTypeError = class extends BaseError {
	constructor(type, { docsPath }) {
		super([`Type "${type}" is not a valid decoding type.`, "Please provide a valid ABI type."].join("\n"), {
			docsPath,
			name: "InvalidAbiDecodingType"
		});
	}
};
var InvalidArrayError = class extends BaseError {
	constructor(value) {
		super([`Value "${value}" is not a valid array.`].join("\n"), { name: "InvalidArrayError" });
	}
};
var InvalidDefinitionTypeError = class extends BaseError {
	constructor(type) {
		super([`"${type}" is not a valid definition type.`, "Valid types: \"function\", \"event\", \"error\""].join("\n"), { name: "InvalidDefinitionTypeError" });
	}
};
//#endregion
//#region node_modules/viem/_esm/errors/data.js
var SliceOffsetOutOfBoundsError = class extends BaseError {
	constructor({ offset, position, size }) {
		super(`Slice ${position === "start" ? "starting" : "ending"} at offset "${offset}" is out-of-bounds (size: ${size}).`, { name: "SliceOffsetOutOfBoundsError" });
	}
};
var SizeExceedsPaddingSizeError = class extends BaseError {
	constructor({ size, targetSize, type }) {
		super(`${type.charAt(0).toUpperCase()}${type.slice(1).toLowerCase()} size (${size}) exceeds padding size (${targetSize}).`, { name: "SizeExceedsPaddingSizeError" });
	}
};
var InvalidBytesLengthError = class extends BaseError {
	constructor({ size, targetSize, type }) {
		super(`${type.charAt(0).toUpperCase()}${type.slice(1).toLowerCase()} is expected to be ${targetSize} ${type} long, but is ${size} ${type} long.`, { name: "InvalidBytesLengthError" });
	}
};
//#endregion
//#region node_modules/viem/_esm/utils/data/pad.js
function pad(hexOrBytes, { dir, size = 32 } = {}) {
	if (typeof hexOrBytes === "string") return padHex(hexOrBytes, {
		dir,
		size
	});
	return padBytes(hexOrBytes, {
		dir,
		size
	});
}
function padHex(hex_, { dir, size = 32 } = {}) {
	if (size === null) return hex_;
	const hex = hex_.replace("0x", "");
	if (hex.length > size * 2) throw new SizeExceedsPaddingSizeError({
		size: Math.ceil(hex.length / 2),
		targetSize: size,
		type: "hex"
	});
	return `0x${hex[dir === "right" ? "padEnd" : "padStart"](size * 2, "0")}`;
}
function padBytes(bytes, { dir, size = 32 } = {}) {
	if (size === null) return bytes;
	if (bytes.length > size) throw new SizeExceedsPaddingSizeError({
		size: bytes.length,
		targetSize: size,
		type: "bytes"
	});
	const paddedBytes = new Uint8Array(size);
	for (let i = 0; i < size; i++) {
		const padEnd = dir === "right";
		paddedBytes[padEnd ? i : size - i - 1] = bytes[padEnd ? i : bytes.length - i - 1];
	}
	return paddedBytes;
}
//#endregion
//#region node_modules/viem/_esm/errors/encoding.js
var IntegerOutOfRangeError = class extends BaseError {
	constructor({ max, min, signed, size, value }) {
		super(`Number "${value}" is not in safe ${size ? `${size * 8}-bit ${signed ? "signed" : "unsigned"} ` : ""}integer range ${max ? `(${min} to ${max})` : `(above ${min})`}`, { name: "IntegerOutOfRangeError" });
	}
};
var InvalidBytesBooleanError = class extends BaseError {
	constructor(bytes) {
		super(`Bytes value "${bytes}" is not a valid boolean. The bytes array must contain a single byte of either a 0 or 1 value.`, { name: "InvalidBytesBooleanError" });
	}
};
var SizeOverflowError = class extends BaseError {
	constructor({ givenSize, maxSize }) {
		super(`Size cannot exceed ${maxSize} bytes. Given size: ${givenSize} bytes.`, { name: "SizeOverflowError" });
	}
};
//#endregion
//#region node_modules/viem/_esm/utils/data/trim.js
function trim(hexOrBytes, { dir = "left" } = {}) {
	let data = typeof hexOrBytes === "string" ? hexOrBytes.replace("0x", "") : hexOrBytes;
	let sliceLength = 0;
	for (let i = 0; i < data.length - 1; i++) if (data[dir === "left" ? i : data.length - i - 1].toString() === "0") sliceLength++;
	else break;
	data = dir === "left" ? data.slice(sliceLength) : data.slice(0, data.length - sliceLength);
	if (typeof hexOrBytes === "string") {
		if (data.length === 1 && dir === "right") data = `${data}0`;
		return `0x${data.length % 2 === 1 ? `0${data}` : data}`;
	}
	return data;
}
//#endregion
//#region node_modules/viem/_esm/utils/encoding/fromHex.js
function assertSize(hexOrBytes, { size }) {
	if (size$1(hexOrBytes) > size) throw new SizeOverflowError({
		givenSize: size$1(hexOrBytes),
		maxSize: size
	});
}
/**
* Decodes a hex value into a bigint.
*
* - Docs: https://viem.sh/docs/utilities/fromHex#hextobigint
*
* @param hex Hex value to decode.
* @param opts Options.
* @returns BigInt value.
*
* @example
* import { hexToBigInt } from 'viem'
* const data = hexToBigInt('0x1a4', { signed: true })
* // 420n
*
* @example
* import { hexToBigInt } from 'viem'
* const data = hexToBigInt('0x00000000000000000000000000000000000000000000000000000000000001a4', { size: 32 })
* // 420n
*/
function hexToBigInt(hex, opts = {}) {
	const { signed } = opts;
	if (opts.size) assertSize(hex, { size: opts.size });
	const value = BigInt(hex);
	if (!signed) return value;
	const size = (hex.length - 2) / 2;
	if (value <= (1n << BigInt(size) * 8n - 1n) - 1n) return value;
	return value - BigInt(`0x${"f".padStart(size * 2, "f")}`) - 1n;
}
/**
* Decodes a hex string into a number.
*
* - Docs: https://viem.sh/docs/utilities/fromHex#hextonumber
*
* @param hex Hex value to decode.
* @param opts Options.
* @returns Number value.
*
* @example
* import { hexToNumber } from 'viem'
* const data = hexToNumber('0x1a4')
* // 420
*
* @example
* import { hexToNumber } from 'viem'
* const data = hexToBigInt('0x00000000000000000000000000000000000000000000000000000000000001a4', { size: 32 })
* // 420
*/
function hexToNumber(hex, opts = {}) {
	const value = hexToBigInt(hex, opts);
	const number = Number(value);
	if (!Number.isSafeInteger(number)) throw new IntegerOutOfRangeError({
		max: `${Number.MAX_SAFE_INTEGER}`,
		min: `${Number.MIN_SAFE_INTEGER}`,
		signed: opts.signed,
		size: opts.size,
		value: `${value}n`
	});
	return number;
}
//#endregion
//#region node_modules/viem/_esm/utils/encoding/toHex.js
var hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_v, i) => i.toString(16).padStart(2, "0"));
/**
* Encodes a string, number, bigint, or ByteArray into a hex string
*
* - Docs: https://viem.sh/docs/utilities/toHex
* - Example: https://viem.sh/docs/utilities/toHex#usage
*
* @param value Value to encode.
* @param opts Options.
* @returns Hex value.
*
* @example
* import { toHex } from 'viem'
* const data = toHex('Hello world')
* // '0x48656c6c6f20776f726c6421'
*
* @example
* import { toHex } from 'viem'
* const data = toHex(420)
* // '0x1a4'
*
* @example
* import { toHex } from 'viem'
* const data = toHex('Hello world', { size: 32 })
* // '0x48656c6c6f20776f726c64210000000000000000000000000000000000000000'
*/
function toHex(value, opts = {}) {
	if (typeof value === "number" || typeof value === "bigint") return numberToHex(value, opts);
	if (typeof value === "string") return stringToHex(value, opts);
	if (typeof value === "boolean") return boolToHex(value, opts);
	return bytesToHex(value, opts);
}
/**
* Encodes a boolean into a hex string
*
* - Docs: https://viem.sh/docs/utilities/toHex#booltohex
*
* @param value Value to encode.
* @param opts Options.
* @returns Hex value.
*
* @example
* import { boolToHex } from 'viem'
* const data = boolToHex(true)
* // '0x1'
*
* @example
* import { boolToHex } from 'viem'
* const data = boolToHex(false)
* // '0x0'
*
* @example
* import { boolToHex } from 'viem'
* const data = boolToHex(true, { size: 32 })
* // '0x0000000000000000000000000000000000000000000000000000000000000001'
*/
function boolToHex(value, opts = {}) {
	const hex = `0x${Number(value)}`;
	if (typeof opts.size === "number") {
		assertSize(hex, { size: opts.size });
		return pad(hex, { size: opts.size });
	}
	return hex;
}
/**
* Encodes a bytes array into a hex string
*
* - Docs: https://viem.sh/docs/utilities/toHex#bytestohex
*
* @param value Value to encode.
* @param opts Options.
* @returns Hex value.
*
* @example
* import { bytesToHex } from 'viem'
* const data = bytesToHex(Uint8Array.from([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33])
* // '0x48656c6c6f20576f726c6421'
*
* @example
* import { bytesToHex } from 'viem'
* const data = bytesToHex(Uint8Array.from([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33]), { size: 32 })
* // '0x48656c6c6f20576f726c64210000000000000000000000000000000000000000'
*/
function bytesToHex(value, opts = {}) {
	let string = "";
	for (let i = 0; i < value.length; i++) string += hexes[value[i]];
	const hex = `0x${string}`;
	if (typeof opts.size === "number") {
		assertSize(hex, { size: opts.size });
		return pad(hex, {
			dir: "right",
			size: opts.size
		});
	}
	return hex;
}
/**
* Encodes a number or bigint into a hex string
*
* - Docs: https://viem.sh/docs/utilities/toHex#numbertohex
*
* @param value Value to encode.
* @param opts Options.
* @returns Hex value.
*
* @example
* import { numberToHex } from 'viem'
* const data = numberToHex(420)
* // '0x1a4'
*
* @example
* import { numberToHex } from 'viem'
* const data = numberToHex(420, { size: 32 })
* // '0x00000000000000000000000000000000000000000000000000000000000001a4'
*/
function numberToHex(value_, opts = {}) {
	const { signed, size } = opts;
	const value = BigInt(value_);
	let maxValue;
	if (size) if (signed) maxValue = (1n << BigInt(size) * 8n - 1n) - 1n;
	else maxValue = 2n ** (BigInt(size) * 8n) - 1n;
	else if (typeof value_ === "number") maxValue = BigInt(Number.MAX_SAFE_INTEGER);
	const minValue = typeof maxValue === "bigint" && signed ? -maxValue - 1n : 0;
	if (maxValue && value > maxValue || value < minValue) {
		const suffix = typeof value_ === "bigint" ? "n" : "";
		throw new IntegerOutOfRangeError({
			max: maxValue ? `${maxValue}${suffix}` : void 0,
			min: `${minValue}${suffix}`,
			signed,
			size,
			value: `${value_}${suffix}`
		});
	}
	const hex = `0x${(signed && value < 0 ? (1n << BigInt(size * 8)) + BigInt(value) : value).toString(16)}`;
	if (size) return pad(hex, { size });
	return hex;
}
var encoder$1 = /* @__PURE__ */ new TextEncoder();
/**
* Encodes a UTF-8 string into a hex string
*
* - Docs: https://viem.sh/docs/utilities/toHex#stringtohex
*
* @param value Value to encode.
* @param opts Options.
* @returns Hex value.
*
* @example
* import { stringToHex } from 'viem'
* const data = stringToHex('Hello World!')
* // '0x48656c6c6f20576f726c6421'
*
* @example
* import { stringToHex } from 'viem'
* const data = stringToHex('Hello World!', { size: 32 })
* // '0x48656c6c6f20576f726c64210000000000000000000000000000000000000000'
*/
function stringToHex(value_, opts = {}) {
	return bytesToHex(encoder$1.encode(value_), opts);
}
//#endregion
//#region node_modules/viem/_esm/utils/encoding/toBytes.js
var encoder = /* @__PURE__ */ new TextEncoder();
/**
* Encodes a UTF-8 string, hex value, bigint, number or boolean to a byte array.
*
* - Docs: https://viem.sh/docs/utilities/toBytes
* - Example: https://viem.sh/docs/utilities/toBytes#usage
*
* @param value Value to encode.
* @param opts Options.
* @returns Byte array value.
*
* @example
* import { toBytes } from 'viem'
* const data = toBytes('Hello world')
* // Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33])
*
* @example
* import { toBytes } from 'viem'
* const data = toBytes(420)
* // Uint8Array([1, 164])
*
* @example
* import { toBytes } from 'viem'
* const data = toBytes(420, { size: 4 })
* // Uint8Array([0, 0, 1, 164])
*/
function toBytes(value, opts = {}) {
	if (typeof value === "number" || typeof value === "bigint") return numberToBytes(value, opts);
	if (typeof value === "boolean") return boolToBytes(value, opts);
	if (isHex(value)) return hexToBytes(value, opts);
	return stringToBytes(value, opts);
}
/**
* Encodes a boolean into a byte array.
*
* - Docs: https://viem.sh/docs/utilities/toBytes#booltobytes
*
* @param value Boolean value to encode.
* @param opts Options.
* @returns Byte array value.
*
* @example
* import { boolToBytes } from 'viem'
* const data = boolToBytes(true)
* // Uint8Array([1])
*
* @example
* import { boolToBytes } from 'viem'
* const data = boolToBytes(true, { size: 32 })
* // Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1])
*/
function boolToBytes(value, opts = {}) {
	const bytes = new Uint8Array(1);
	bytes[0] = Number(value);
	if (typeof opts.size === "number") {
		assertSize(bytes, { size: opts.size });
		return pad(bytes, { size: opts.size });
	}
	return bytes;
}
var charCodeMap = {
	zero: 48,
	nine: 57,
	A: 65,
	F: 70,
	a: 97,
	f: 102
};
function charCodeToBase16(char) {
	if (char >= charCodeMap.zero && char <= charCodeMap.nine) return char - charCodeMap.zero;
	if (char >= charCodeMap.A && char <= charCodeMap.F) return char - (charCodeMap.A - 10);
	if (char >= charCodeMap.a && char <= charCodeMap.f) return char - (charCodeMap.a - 10);
}
/**
* Encodes a hex string into a byte array.
*
* - Docs: https://viem.sh/docs/utilities/toBytes#hextobytes
*
* @param hex Hex string to encode.
* @param opts Options.
* @returns Byte array value.
*
* @example
* import { hexToBytes } from 'viem'
* const data = hexToBytes('0x48656c6c6f20776f726c6421')
* // Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33])
*
* @example
* import { hexToBytes } from 'viem'
* const data = hexToBytes('0x48656c6c6f20776f726c6421', { size: 32 })
* // Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
*/
function hexToBytes(hex_, opts = {}) {
	let hex = hex_;
	if (opts.size) {
		assertSize(hex, { size: opts.size });
		hex = pad(hex, {
			dir: "right",
			size: opts.size
		});
	}
	let hexString = hex.slice(2);
	if (hexString.length % 2) hexString = `0${hexString}`;
	const length = hexString.length / 2;
	const bytes = new Uint8Array(length);
	for (let index = 0, j = 0; index < length; index++) {
		const nibbleLeft = charCodeToBase16(hexString.charCodeAt(j++));
		const nibbleRight = charCodeToBase16(hexString.charCodeAt(j++));
		if (nibbleLeft === void 0 || nibbleRight === void 0) throw new BaseError(`Invalid byte sequence ("${hexString[j - 2]}${hexString[j - 1]}" in "${hexString}").`);
		bytes[index] = nibbleLeft * 16 + nibbleRight;
	}
	return bytes;
}
/**
* Encodes a number into a byte array.
*
* - Docs: https://viem.sh/docs/utilities/toBytes#numbertobytes
*
* @param value Number to encode.
* @param opts Options.
* @returns Byte array value.
*
* @example
* import { numberToBytes } from 'viem'
* const data = numberToBytes(420)
* // Uint8Array([1, 164])
*
* @example
* import { numberToBytes } from 'viem'
* const data = numberToBytes(420, { size: 4 })
* // Uint8Array([0, 0, 1, 164])
*/
function numberToBytes(value, opts) {
	return hexToBytes(numberToHex(value, opts));
}
/**
* Encodes a UTF-8 string into a byte array.
*
* - Docs: https://viem.sh/docs/utilities/toBytes#stringtobytes
*
* @param value String to encode.
* @param opts Options.
* @returns Byte array value.
*
* @example
* import { stringToBytes } from 'viem'
* const data = stringToBytes('Hello world!')
* // Uint8Array([72, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100, 33])
*
* @example
* import { stringToBytes } from 'viem'
* const data = stringToBytes('Hello world!', { size: 32 })
* // Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
*/
function stringToBytes(value, opts = {}) {
	const bytes = encoder.encode(value);
	if (typeof opts.size === "number") {
		assertSize(bytes, { size: opts.size });
		return pad(bytes, {
			dir: "right",
			size: opts.size
		});
	}
	return bytes;
}
//#endregion
//#region node_modules/viem/node_modules/@noble/hashes/esm/sha3.js
/**
* SHA3 (keccak) hash function, based on a new "Sponge function" design.
* Different from older hashes, the internal state is bigger than output size.
*
* Check out [FIPS-202](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf),
* [Website](https://keccak.team/keccak.html),
* [the differences between SHA-3 and Keccak](https://crypto.stackexchange.com/questions/15727/what-are-the-key-differences-between-the-draft-sha-3-standard-and-the-keccak-sub).
*
* Check out `sha3-addons` module for cSHAKE, k12, and others.
* @module
*/
var _0n = BigInt(0);
var _1n = BigInt(1);
var _2n = BigInt(2);
var _7n = BigInt(7);
var _256n = BigInt(256);
var _0x71n = BigInt(113);
var SHA3_PI = [];
var SHA3_ROTL = [];
var _SHA3_IOTA = [];
for (let round = 0, R = _1n, x = 1, y = 0; round < 24; round++) {
	[x, y] = [y, (2 * x + 3 * y) % 5];
	SHA3_PI.push(2 * (5 * y + x));
	SHA3_ROTL.push((round + 1) * (round + 2) / 2 % 64);
	let t = _0n;
	for (let j = 0; j < 7; j++) {
		R = (R << _1n ^ (R >> _7n) * _0x71n) % _256n;
		if (R & _2n) t ^= _1n << (_1n << /* @__PURE__ */ BigInt(j)) - _1n;
	}
	_SHA3_IOTA.push(t);
}
var IOTAS = split(_SHA3_IOTA, true);
var SHA3_IOTA_H = IOTAS[0];
var SHA3_IOTA_L = IOTAS[1];
var rotlH = (h, l, s) => s > 32 ? rotlBH(h, l, s) : rotlSH(h, l, s);
var rotlL = (h, l, s) => s > 32 ? rotlBL(h, l, s) : rotlSL(h, l, s);
/** `keccakf1600` internal function, additionally allows to adjust round count. */
function keccakP(s, rounds = 24) {
	const B = new Uint32Array(10);
	for (let round = 24 - rounds; round < 24; round++) {
		for (let x = 0; x < 10; x++) B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
		for (let x = 0; x < 10; x += 2) {
			const idx1 = (x + 8) % 10;
			const idx0 = (x + 2) % 10;
			const B0 = B[idx0];
			const B1 = B[idx0 + 1];
			const Th = rotlH(B0, B1, 1) ^ B[idx1];
			const Tl = rotlL(B0, B1, 1) ^ B[idx1 + 1];
			for (let y = 0; y < 50; y += 10) {
				s[x + y] ^= Th;
				s[x + y + 1] ^= Tl;
			}
		}
		let curH = s[2];
		let curL = s[3];
		for (let t = 0; t < 24; t++) {
			const shift = SHA3_ROTL[t];
			const Th = rotlH(curH, curL, shift);
			const Tl = rotlL(curH, curL, shift);
			const PI = SHA3_PI[t];
			curH = s[PI];
			curL = s[PI + 1];
			s[PI] = Th;
			s[PI + 1] = Tl;
		}
		for (let y = 0; y < 50; y += 10) {
			for (let x = 0; x < 10; x++) B[x] = s[y + x];
			for (let x = 0; x < 10; x++) s[y + x] ^= ~B[(x + 2) % 10] & B[(x + 4) % 10];
		}
		s[0] ^= SHA3_IOTA_H[round];
		s[1] ^= SHA3_IOTA_L[round];
	}
	clean(B);
}
/** Keccak sponge function. */
var Keccak = class Keccak extends Hash {
	constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
		super();
		this.pos = 0;
		this.posOut = 0;
		this.finished = false;
		this.destroyed = false;
		this.enableXOF = false;
		this.blockLen = blockLen;
		this.suffix = suffix;
		this.outputLen = outputLen;
		this.enableXOF = enableXOF;
		this.rounds = rounds;
		anumber(outputLen);
		if (!(0 < blockLen && blockLen < 200)) throw new Error("only keccak-f1600 function is supported");
		this.state = new Uint8Array(200);
		this.state32 = u32(this.state);
	}
	clone() {
		return this._cloneInto();
	}
	keccak() {
		swap32IfBE(this.state32);
		keccakP(this.state32, this.rounds);
		swap32IfBE(this.state32);
		this.posOut = 0;
		this.pos = 0;
	}
	update(data) {
		aexists(this);
		data = toBytes$1(data);
		abytes(data);
		const { blockLen, state } = this;
		const len = data.length;
		for (let pos = 0; pos < len;) {
			const take = Math.min(blockLen - this.pos, len - pos);
			for (let i = 0; i < take; i++) state[this.pos++] ^= data[pos++];
			if (this.pos === blockLen) this.keccak();
		}
		return this;
	}
	finish() {
		if (this.finished) return;
		this.finished = true;
		const { state, suffix, pos, blockLen } = this;
		state[pos] ^= suffix;
		if ((suffix & 128) !== 0 && pos === blockLen - 1) this.keccak();
		state[blockLen - 1] ^= 128;
		this.keccak();
	}
	writeInto(out) {
		aexists(this, false);
		abytes(out);
		this.finish();
		const bufferOut = this.state;
		const { blockLen } = this;
		for (let pos = 0, len = out.length; pos < len;) {
			if (this.posOut >= blockLen) this.keccak();
			const take = Math.min(blockLen - this.posOut, len - pos);
			out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
			this.posOut += take;
			pos += take;
		}
		return out;
	}
	xofInto(out) {
		if (!this.enableXOF) throw new Error("XOF is not possible for this instance");
		return this.writeInto(out);
	}
	xof(bytes) {
		anumber(bytes);
		return this.xofInto(new Uint8Array(bytes));
	}
	digestInto(out) {
		aoutput(out, this);
		if (this.finished) throw new Error("digest() was already called");
		this.writeInto(out);
		this.destroy();
		return out;
	}
	digest() {
		return this.digestInto(new Uint8Array(this.outputLen));
	}
	destroy() {
		this.destroyed = true;
		clean(this.state);
	}
	_cloneInto(to) {
		const { blockLen, suffix, outputLen, rounds, enableXOF } = this;
		to || (to = new Keccak(blockLen, suffix, outputLen, enableXOF, rounds));
		to.state32.set(this.state32);
		to.pos = this.pos;
		to.posOut = this.posOut;
		to.finished = this.finished;
		to.rounds = rounds;
		to.suffix = suffix;
		to.outputLen = outputLen;
		to.enableXOF = enableXOF;
		to.destroyed = this.destroyed;
		return to;
	}
};
var gen = (suffix, blockLen, outputLen) => createHasher(() => new Keccak(blockLen, suffix, outputLen));
/** keccak-256 hash function. Different from SHA3-256. */
var keccak_256 = /* @__PURE__ */ (() => gen(1, 136, 256 / 8))();
//#endregion
//#region node_modules/viem/_esm/utils/hash/keccak256.js
function keccak256(value, to_) {
	const to = to_ || "hex";
	const bytes = keccak_256(isHex(value, { strict: false }) ? toBytes(value) : value);
	if (to === "bytes") return bytes;
	return toHex(bytes);
}
//#endregion
//#region node_modules/viem/_esm/utils/hash/hashSignature.js
var hash = (value) => keccak256(toBytes(value));
function hashSignature(sig) {
	return hash(sig);
}
//#endregion
//#region node_modules/viem/_esm/utils/hash/normalizeSignature.js
function normalizeSignature(signature) {
	let active = true;
	let current = "";
	let level = 0;
	let result = "";
	let valid = false;
	for (let i = 0; i < signature.length; i++) {
		const char = signature[i];
		if ([
			"(",
			")",
			","
		].includes(char)) active = true;
		if (char === "(") level++;
		if (char === ")") level--;
		if (!active) continue;
		if (level === 0) {
			if (char === " " && [
				"event",
				"function",
				""
			].includes(result)) result = "";
			else {
				result += char;
				if (char === ")") {
					valid = true;
					break;
				}
			}
			continue;
		}
		if (char === " ") {
			if (signature[i - 1] !== "," && current !== "," && current !== ",(") {
				current = "";
				active = false;
			}
			continue;
		}
		result += char;
		current += char;
	}
	if (!valid) throw new BaseError("Unable to normalize signature.");
	return result;
}
//#endregion
//#region node_modules/viem/_esm/utils/hash/toSignature.js
/**
* Returns the signature for a given function or event definition.
*
* @example
* const signature = toSignature('function ownerOf(uint256 tokenId)')
* // 'ownerOf(uint256)'
*
* @example
* const signature_3 = toSignature({
*   name: 'ownerOf',
*   type: 'function',
*   inputs: [{ name: 'tokenId', type: 'uint256' }],
*   outputs: [],
*   stateMutability: 'view',
* })
* // 'ownerOf(uint256)'
*/
var toSignature = (def) => {
	return normalizeSignature((() => {
		if (typeof def === "string") return def;
		return formatAbiItem$1(def);
	})());
};
//#endregion
//#region node_modules/viem/_esm/utils/hash/toSignatureHash.js
/**
* Returns the hash (of the function/event signature) for a given event or function definition.
*/
function toSignatureHash(fn) {
	return hashSignature(toSignature(fn));
}
//#endregion
//#region node_modules/viem/_esm/utils/hash/toEventSelector.js
/**
* Returns the event selector for a given event definition.
*
* @example
* const selector = toEventSelector('Transfer(address indexed from, address indexed to, uint256 amount)')
* // 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
*/
var toEventSelector = toSignatureHash;
//#endregion
//#region node_modules/viem/_esm/errors/address.js
var InvalidAddressError = class extends BaseError {
	constructor({ address }) {
		super(`Address "${address}" is invalid.`, {
			metaMessages: ["- Address must be a hex value of 20 bytes (40 hex characters).", "- Address must match its checksum counterpart."],
			name: "InvalidAddressError"
		});
	}
};
//#endregion
//#region node_modules/viem/_esm/utils/lru.js
/**
* Map with a LRU (Least recently used) policy.
*
* @link https://en.wikipedia.org/wiki/Cache_replacement_policies#LRU
*/
var LruMap = class extends Map {
	constructor(size) {
		super();
		Object.defineProperty(this, "maxSize", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		this.maxSize = size;
	}
	get(key) {
		const value = super.get(key);
		if (super.has(key)) {
			super.delete(key);
			super.set(key, value);
		}
		return value;
	}
	set(key, value) {
		if (super.has(key)) super.delete(key);
		super.set(key, value);
		if (this.maxSize && this.size > this.maxSize) {
			const firstKey = super.keys().next().value;
			if (firstKey !== void 0) super.delete(firstKey);
		}
		return this;
	}
};
//#endregion
//#region node_modules/viem/_esm/utils/address/getAddress.js
var checksumAddressCache = /* @__PURE__ */ new LruMap(8192);
function checksumAddress(address_, chainId) {
	if (checksumAddressCache.has(`${address_}.${chainId}`)) return checksumAddressCache.get(`${address_}.${chainId}`);
	const hexAddress = chainId ? `${chainId}${address_.toLowerCase()}` : address_.substring(2).toLowerCase();
	const hash = keccak256(stringToBytes(hexAddress), "bytes");
	const address = (chainId ? hexAddress.substring(`${chainId}0x`.length) : hexAddress).split("");
	for (let i = 0; i < 40; i += 2) {
		if (hash[i >> 1] >> 4 >= 8 && address[i]) address[i] = address[i].toUpperCase();
		if ((hash[i >> 1] & 15) >= 8 && address[i + 1]) address[i + 1] = address[i + 1].toUpperCase();
	}
	const result = `0x${address.join("")}`;
	checksumAddressCache.set(`${address_}.${chainId}`, result);
	return result;
}
//#endregion
//#region node_modules/viem/_esm/utils/address/isAddress.js
var addressRegex = /^0x[a-fA-F0-9]{40}$/;
/** @internal */
var isAddressCache = /* @__PURE__ */ new LruMap(8192);
function isAddress(address, options) {
	const { strict = true } = options ?? {};
	const cacheKey = `${address}.${strict}`;
	if (isAddressCache.has(cacheKey)) return isAddressCache.get(cacheKey);
	const result = (() => {
		if (!addressRegex.test(address)) return false;
		if (address.toLowerCase() === address) return true;
		if (strict) return checksumAddress(address) === address;
		return true;
	})();
	isAddressCache.set(cacheKey, result);
	return result;
}
//#endregion
//#region node_modules/viem/_esm/utils/data/concat.js
function concat(values) {
	if (typeof values[0] === "string") return concatHex(values);
	return concatBytes(values);
}
function concatBytes(values) {
	let length = 0;
	for (const arr of values) length += arr.length;
	const result = new Uint8Array(length);
	let offset = 0;
	for (const arr of values) {
		result.set(arr, offset);
		offset += arr.length;
	}
	return result;
}
function concatHex(values) {
	return `0x${values.reduce((acc, x) => acc + x.replace("0x", ""), "")}`;
}
//#endregion
//#region node_modules/viem/_esm/utils/data/slice.js
/**
* @description Returns a section of the hex or byte array given a start/end bytes offset.
*
* @param value The hex or byte array to slice.
* @param start The start offset (in bytes).
* @param end The end offset (in bytes).
*/
function slice(value, start, end, { strict } = {}) {
	if (isHex(value, { strict: false })) return sliceHex(value, start, end, { strict });
	return sliceBytes(value, start, end, { strict });
}
function assertStartOffset(value, start) {
	if (typeof start === "number" && start > 0 && start > size$1(value) - 1) throw new SliceOffsetOutOfBoundsError({
		offset: start,
		position: "start",
		size: size$1(value)
	});
}
function assertEndOffset(value, start, end) {
	if (typeof start === "number" && typeof end === "number" && size$1(value) !== end - start) throw new SliceOffsetOutOfBoundsError({
		offset: end,
		position: "end",
		size: size$1(value)
	});
}
/**
* @description Returns a section of the byte array given a start/end bytes offset.
*
* @param value The byte array to slice.
* @param start The start offset (in bytes).
* @param end The end offset (in bytes).
*/
function sliceBytes(value_, start, end, { strict } = {}) {
	assertStartOffset(value_, start);
	const value = value_.slice(start, end);
	if (strict) assertEndOffset(value, start, end);
	return value;
}
/**
* @description Returns a section of the hex value given a start/end bytes offset.
*
* @param value The hex value to slice.
* @param start The start offset (in bytes).
* @param end The end offset (in bytes).
*/
function sliceHex(value_, start, end, { strict } = {}) {
	assertStartOffset(value_, start);
	const value = `0x${value_.replace("0x", "").slice((start ?? 0) * 2, (end ?? value_.length) * 2)}`;
	if (strict) assertEndOffset(value, start, end);
	return value;
}
//#endregion
//#region node_modules/viem/_esm/utils/regex.js
var integerRegex = /^(u?int)(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?$/;
//#endregion
//#region node_modules/viem/_esm/utils/abi/encodeAbiParameters.js
/**
* @description Encodes a list of primitive values into an ABI-encoded hex value.
*
* - Docs: https://viem.sh/docs/abi/encodeAbiParameters#encodeabiparameters
*
*   Generates ABI encoded data using the [ABI specification](https://docs.soliditylang.org/en/latest/abi-spec), given a set of ABI parameters (inputs/outputs) and their corresponding values.
*
* @param params - a set of ABI Parameters (params), that can be in the shape of the inputs or outputs attribute of an ABI Item.
* @param values - a set of values (values) that correspond to the given params.
* @example
* ```typescript
* import { encodeAbiParameters } from 'viem'
*
* const encodedData = encodeAbiParameters(
*   [
*     { name: 'x', type: 'string' },
*     { name: 'y', type: 'uint' },
*     { name: 'z', type: 'bool' }
*   ],
*   ['wagmi', 420n, true]
* )
* ```
*
* You can also pass in Human Readable parameters with the parseAbiParameters utility.
*
* @example
* ```typescript
* import { encodeAbiParameters, parseAbiParameters } from 'viem'
*
* const encodedData = encodeAbiParameters(
*   parseAbiParameters('string x, uint y, bool z'),
*   ['wagmi', 420n, true]
* )
* ```
*/
function encodeAbiParameters(params, values) {
	if (params.length !== values.length) throw new AbiEncodingLengthMismatchError({
		expectedLength: params.length,
		givenLength: values.length
	});
	const data = encodeParams(prepareParams({
		params,
		values
	}));
	if (data.length === 0) return "0x";
	return data;
}
function prepareParams({ params, values }) {
	const preparedParams = [];
	for (let i = 0; i < params.length; i++) preparedParams.push(prepareParam({
		param: params[i],
		value: values[i]
	}));
	return preparedParams;
}
function prepareParam({ param, value }) {
	const arrayComponents = getArrayComponents(param.type);
	if (arrayComponents) {
		const [length, type] = arrayComponents;
		return encodeArray(value, {
			length,
			param: {
				...param,
				type
			}
		});
	}
	if (param.type === "tuple") return encodeTuple(value, { param });
	if (param.type === "address") return encodeAddress(value);
	if (param.type === "bool") return encodeBool(value);
	if (param.type.startsWith("uint") || param.type.startsWith("int")) {
		const signed = param.type.startsWith("int");
		const [, , size = "256"] = integerRegex.exec(param.type) ?? [];
		return encodeNumber(value, {
			signed,
			size: Number(size)
		});
	}
	if (param.type.startsWith("bytes")) return encodeBytes(value, { param });
	if (param.type === "string") return encodeString(value);
	throw new InvalidAbiEncodingTypeError(param.type, { docsPath: "/docs/contract/encodeAbiParameters" });
}
function encodeParams(preparedParams) {
	let staticSize = 0;
	for (let i = 0; i < preparedParams.length; i++) {
		const { dynamic, encoded } = preparedParams[i];
		if (dynamic) staticSize += 32;
		else staticSize += size$1(encoded);
	}
	const staticParams = [];
	const dynamicParams = [];
	let dynamicSize = 0;
	for (let i = 0; i < preparedParams.length; i++) {
		const { dynamic, encoded } = preparedParams[i];
		if (dynamic) {
			staticParams.push(numberToHex(staticSize + dynamicSize, { size: 32 }));
			dynamicParams.push(encoded);
			dynamicSize += size$1(encoded);
		} else staticParams.push(encoded);
	}
	return concat([...staticParams, ...dynamicParams]);
}
function encodeAddress(value) {
	if (!isAddress(value)) throw new InvalidAddressError({ address: value });
	return {
		dynamic: false,
		encoded: padHex(value.toLowerCase())
	};
}
function encodeArray(value, { length, param }) {
	const dynamic = length === null;
	if (!Array.isArray(value)) throw new InvalidArrayError(value);
	if (!dynamic && value.length !== length) throw new AbiEncodingArrayLengthMismatchError({
		expectedLength: length,
		givenLength: value.length,
		type: `${param.type}[${length}]`
	});
	let dynamicChild = false;
	const preparedParams = [];
	for (let i = 0; i < value.length; i++) {
		const preparedParam = prepareParam({
			param,
			value: value[i]
		});
		if (preparedParam.dynamic) dynamicChild = true;
		preparedParams.push(preparedParam);
	}
	if (dynamic || dynamicChild) {
		const data = encodeParams(preparedParams);
		if (dynamic) {
			const length = numberToHex(preparedParams.length, { size: 32 });
			return {
				dynamic: true,
				encoded: preparedParams.length > 0 ? concat([length, data]) : length
			};
		}
		if (dynamicChild) return {
			dynamic: true,
			encoded: data
		};
	}
	return {
		dynamic: false,
		encoded: concat(preparedParams.map(({ encoded }) => encoded))
	};
}
function encodeBytes(value, { param }) {
	const [, paramSize] = param.type.split("bytes");
	const bytesSize = size$1(value);
	if (!paramSize) {
		let value_ = value;
		if (bytesSize % 32 !== 0) value_ = padHex(value_, {
			dir: "right",
			size: Math.ceil((value.length - 2) / 2 / 32) * 32
		});
		return {
			dynamic: true,
			encoded: concat([padHex(numberToHex(bytesSize, { size: 32 })), value_])
		};
	}
	if (bytesSize !== Number.parseInt(paramSize, 10)) throw new AbiEncodingBytesSizeMismatchError({
		expectedSize: Number.parseInt(paramSize, 10),
		value
	});
	return {
		dynamic: false,
		encoded: padHex(value, { dir: "right" })
	};
}
function encodeBool(value) {
	if (typeof value !== "boolean") throw new BaseError(`Invalid boolean value: "${value}" (type: ${typeof value}). Expected: \`true\` or \`false\`.`);
	return {
		dynamic: false,
		encoded: padHex(boolToHex(value))
	};
}
function encodeNumber(value, { signed, size = 256 }) {
	if (typeof size === "number") {
		const max = 2n ** (BigInt(size) - (signed ? 1n : 0n)) - 1n;
		const min = signed ? -max - 1n : 0n;
		if (value > max || value < min) throw new IntegerOutOfRangeError({
			max: max.toString(),
			min: min.toString(),
			signed,
			size: size / 8,
			value: value.toString()
		});
	}
	return {
		dynamic: false,
		encoded: numberToHex(value, {
			size: 32,
			signed
		})
	};
}
function encodeString(value) {
	const hexValue = stringToHex(value);
	const partsLength = Math.ceil(size$1(hexValue) / 32);
	const parts = [];
	for (let i = 0; i < partsLength; i++) parts.push(padHex(slice(hexValue, i * 32, (i + 1) * 32), { dir: "right" }));
	return {
		dynamic: true,
		encoded: concat([padHex(numberToHex(size$1(hexValue), { size: 32 })), ...parts])
	};
}
function encodeTuple(value, { param }) {
	let dynamic = false;
	const preparedParams = [];
	for (let i = 0; i < param.components.length; i++) {
		const param_ = param.components[i];
		const preparedParam = prepareParam({
			param: param_,
			value: value[Array.isArray(value) ? i : param_.name]
		});
		preparedParams.push(preparedParam);
		if (preparedParam.dynamic) dynamic = true;
	}
	return {
		dynamic,
		encoded: dynamic ? encodeParams(preparedParams) : concat(preparedParams.map(({ encoded }) => encoded))
	};
}
function getArrayComponents(type) {
	const matches = type.match(/^(.*)\[(\d+)?\]$/);
	return matches ? [matches[2] ? Number(matches[2]) : null, matches[1]] : void 0;
}
//#endregion
//#region node_modules/viem/_esm/utils/hash/toFunctionSelector.js
/**
* Returns the function selector for a given function definition.
*
* @example
* const selector = toFunctionSelector('function ownerOf(uint256 tokenId)')
* // 0x6352211e
*/
var toFunctionSelector = (fn) => slice(toSignatureHash(fn), 0, 4);
//#endregion
//#region node_modules/viem/_esm/utils/abi/getAbiItem.js
function getAbiItem(parameters) {
	const { abi, args = [], name } = parameters;
	const isSelector = isHex(name, { strict: false });
	const abiItems = abi.filter((abiItem) => {
		if (isSelector) {
			if (abiItem.type === "function") return toFunctionSelector(abiItem) === name;
			if (abiItem.type === "event") return toEventSelector(abiItem) === name;
			return false;
		}
		return "name" in abiItem && abiItem.name === name;
	});
	if (abiItems.length === 0) return void 0;
	if (abiItems.length === 1) return abiItems[0];
	let matchedAbiItem;
	for (const abiItem of abiItems) {
		if (!("inputs" in abiItem)) continue;
		if (!args || args.length === 0) {
			if (!abiItem.inputs || abiItem.inputs.length === 0) return abiItem;
			continue;
		}
		if (!abiItem.inputs) continue;
		if (abiItem.inputs.length === 0) continue;
		if (abiItem.inputs.length !== args.length) continue;
		if (args.every((arg, index) => {
			const abiParameter = "inputs" in abiItem && abiItem.inputs[index];
			if (!abiParameter) return false;
			return isArgOfType(arg, abiParameter);
		})) {
			if (matchedAbiItem && "inputs" in matchedAbiItem && matchedAbiItem.inputs) {
				const ambiguousTypes = getAmbiguousTypes(abiItem.inputs, matchedAbiItem.inputs, args);
				if (ambiguousTypes) throw new AbiItemAmbiguityError({
					abiItem,
					type: ambiguousTypes[0]
				}, {
					abiItem: matchedAbiItem,
					type: ambiguousTypes[1]
				});
			}
			matchedAbiItem = abiItem;
		}
	}
	if (matchedAbiItem) return matchedAbiItem;
	return abiItems[0];
}
/** @internal */
function isArgOfType(arg, abiParameter) {
	const argType = typeof arg;
	const abiParameterType = abiParameter.type;
	switch (abiParameterType) {
		case "address": return isAddress(arg, { strict: false });
		case "bool": return argType === "boolean";
		case "function": return argType === "string";
		case "string": return argType === "string";
		default:
			if (abiParameterType === "tuple" && "components" in abiParameter) return Object.values(abiParameter.components).every((component, index) => {
				return argType === "object" && isArgOfType(Object.values(arg)[index], component);
			});
			if (/^u?int(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?$/.test(abiParameterType)) return argType === "number" || argType === "bigint";
			if (/^bytes([1-9]|1[0-9]|2[0-9]|3[0-2])?$/.test(abiParameterType)) return argType === "string" || arg instanceof Uint8Array;
			if (/[a-z]+[1-9]{0,3}(\[[0-9]{0,}\])+$/.test(abiParameterType)) return Array.isArray(arg) && arg.every((x) => isArgOfType(x, {
				...abiParameter,
				type: abiParameterType.replace(/(\[[0-9]{0,}\])$/, "")
			}));
			return false;
	}
}
/** @internal */
function getAmbiguousTypes(sourceParameters, targetParameters, args) {
	for (const parameterIndex in sourceParameters) {
		const sourceParameter = sourceParameters[parameterIndex];
		const targetParameter = targetParameters[parameterIndex];
		if (sourceParameter.type === "tuple" && targetParameter.type === "tuple" && "components" in sourceParameter && "components" in targetParameter) return getAmbiguousTypes(sourceParameter.components, targetParameter.components, args[parameterIndex]);
		const types = [sourceParameter.type, targetParameter.type];
		if ((() => {
			if (types.includes("address") && types.includes("bytes20")) return true;
			if (types.includes("address") && types.includes("string")) return isAddress(args[parameterIndex], { strict: false });
			if (types.includes("address") && types.includes("bytes")) return isAddress(args[parameterIndex], { strict: false });
			return false;
		})()) return types;
	}
}
//#endregion
//#region node_modules/viem/_esm/accounts/utils/parseAccount.js
function parseAccount(account) {
	if (typeof account === "string") return {
		address: account,
		type: "json-rpc"
	};
	return account;
}
//#endregion
//#region node_modules/viem/_esm/utils/abi/prepareEncodeFunctionData.js
var docsPath = "/docs/contract/encodeFunctionData";
function prepareEncodeFunctionData(parameters) {
	const { abi, args, functionName } = parameters;
	let abiItem = abi[0];
	if (functionName) {
		const item = getAbiItem({
			abi,
			args,
			name: functionName
		});
		if (!item) throw new AbiFunctionNotFoundError(functionName, { docsPath });
		abiItem = item;
	}
	if (abiItem.type !== "function") throw new AbiFunctionNotFoundError(void 0, { docsPath });
	return {
		abi: [abiItem],
		functionName: toFunctionSelector(formatAbiItem(abiItem))
	};
}
//#endregion
//#region node_modules/viem/_esm/utils/abi/encodeFunctionData.js
function encodeFunctionData(parameters) {
	const { args } = parameters;
	const { abi, functionName } = (() => {
		if (parameters.abi.length === 1 && parameters.functionName?.startsWith("0x")) return parameters;
		return prepareEncodeFunctionData(parameters);
	})();
	const abiItem = abi[0];
	return concatHex([functionName, ("inputs" in abiItem && abiItem.inputs ? encodeAbiParameters(abiItem.inputs, args ?? []) : void 0) ?? "0x"]);
}
//#endregion
//#region node_modules/viem/_esm/constants/solidity.js
var panicReasons = {
	1: "An `assert` condition failed.",
	17: "Arithmetic operation resulted in underflow or overflow.",
	18: "Division or modulo by zero (e.g. `5 / 0` or `23 % 0`).",
	33: "Attempted to convert to an invalid type.",
	34: "Attempted to access a storage byte array that is incorrectly encoded.",
	49: "Performed `.pop()` on an empty array",
	50: "Array index is out of bounds.",
	65: "Allocated too much memory or created an array which is too large.",
	81: "Attempted to call a zero-initialized variable of internal function type."
};
var solidityError = {
	inputs: [{
		name: "message",
		type: "string"
	}],
	name: "Error",
	type: "error"
};
var solidityPanic = {
	inputs: [{
		name: "reason",
		type: "uint256"
	}],
	name: "Panic",
	type: "error"
};
//#endregion
//#region node_modules/viem/_esm/errors/cursor.js
var NegativeOffsetError = class extends BaseError {
	constructor({ offset }) {
		super(`Offset \`${offset}\` cannot be negative.`, { name: "NegativeOffsetError" });
	}
};
var PositionOutOfBoundsError = class extends BaseError {
	constructor({ length, position }) {
		super(`Position \`${position}\` is out of bounds (\`0 < position < ${length}\`).`, { name: "PositionOutOfBoundsError" });
	}
};
var RecursiveReadLimitExceededError = class extends BaseError {
	constructor({ count, limit }) {
		super(`Recursive read limit of \`${limit}\` exceeded (recursive read count: \`${count}\`).`, { name: "RecursiveReadLimitExceededError" });
	}
};
//#endregion
//#region node_modules/viem/_esm/utils/cursor.js
var staticCursor = {
	bytes: new Uint8Array(),
	dataView: /* @__PURE__ */ new DataView(/* @__PURE__ */ new ArrayBuffer(0)),
	position: 0,
	positionReadCount: /* @__PURE__ */ new Map(),
	recursiveReadCount: 0,
	recursiveReadLimit: Number.POSITIVE_INFINITY,
	assertReadLimit() {
		if (this.recursiveReadCount >= this.recursiveReadLimit) throw new RecursiveReadLimitExceededError({
			count: this.recursiveReadCount + 1,
			limit: this.recursiveReadLimit
		});
	},
	assertPosition(position) {
		if (position < 0 || position > this.bytes.length - 1) throw new PositionOutOfBoundsError({
			length: this.bytes.length,
			position
		});
	},
	decrementPosition(offset) {
		if (offset < 0) throw new NegativeOffsetError({ offset });
		const position = this.position - offset;
		this.assertPosition(position);
		this.position = position;
	},
	getReadCount(position) {
		return this.positionReadCount.get(position || this.position) || 0;
	},
	incrementPosition(offset) {
		if (offset < 0) throw new NegativeOffsetError({ offset });
		const position = this.position + offset;
		this.assertPosition(position);
		this.position = position;
	},
	inspectByte(position_) {
		const position = position_ ?? this.position;
		this.assertPosition(position);
		return this.bytes[position];
	},
	inspectBytes(length, position_) {
		const position = position_ ?? this.position;
		this.assertPosition(position + length - 1);
		return this.bytes.subarray(position, position + length);
	},
	inspectUint8(position_) {
		const position = position_ ?? this.position;
		this.assertPosition(position);
		return this.bytes[position];
	},
	inspectUint16(position_) {
		const position = position_ ?? this.position;
		this.assertPosition(position + 1);
		return this.dataView.getUint16(position);
	},
	inspectUint24(position_) {
		const position = position_ ?? this.position;
		this.assertPosition(position + 2);
		return (this.dataView.getUint16(position) << 8) + this.dataView.getUint8(position + 2);
	},
	inspectUint32(position_) {
		const position = position_ ?? this.position;
		this.assertPosition(position + 3);
		return this.dataView.getUint32(position);
	},
	pushByte(byte) {
		this.assertPosition(this.position);
		this.bytes[this.position] = byte;
		this.position++;
	},
	pushBytes(bytes) {
		this.assertPosition(this.position + bytes.length - 1);
		this.bytes.set(bytes, this.position);
		this.position += bytes.length;
	},
	pushUint8(value) {
		this.assertPosition(this.position);
		this.bytes[this.position] = value;
		this.position++;
	},
	pushUint16(value) {
		this.assertPosition(this.position + 1);
		this.dataView.setUint16(this.position, value);
		this.position += 2;
	},
	pushUint24(value) {
		this.assertPosition(this.position + 2);
		this.dataView.setUint16(this.position, value >> 8);
		this.dataView.setUint8(this.position + 2, value & 255);
		this.position += 3;
	},
	pushUint32(value) {
		this.assertPosition(this.position + 3);
		this.dataView.setUint32(this.position, value);
		this.position += 4;
	},
	readByte() {
		this.assertReadLimit();
		this._touch();
		const value = this.inspectByte();
		this.position++;
		return value;
	},
	readBytes(length, size) {
		this.assertReadLimit();
		this._touch();
		const value = this.inspectBytes(length);
		this.position += size ?? length;
		return value;
	},
	readUint8() {
		this.assertReadLimit();
		this._touch();
		const value = this.inspectUint8();
		this.position += 1;
		return value;
	},
	readUint16() {
		this.assertReadLimit();
		this._touch();
		const value = this.inspectUint16();
		this.position += 2;
		return value;
	},
	readUint24() {
		this.assertReadLimit();
		this._touch();
		const value = this.inspectUint24();
		this.position += 3;
		return value;
	},
	readUint32() {
		this.assertReadLimit();
		this._touch();
		const value = this.inspectUint32();
		this.position += 4;
		return value;
	},
	get remaining() {
		return this.bytes.length - this.position;
	},
	setPosition(position) {
		const oldPosition = this.position;
		this.assertPosition(position);
		this.position = position;
		return () => this.position = oldPosition;
	},
	_touch() {
		if (this.recursiveReadLimit === Number.POSITIVE_INFINITY) return;
		const count = this.getReadCount();
		this.positionReadCount.set(this.position, count + 1);
		if (count > 0) this.recursiveReadCount++;
	}
};
function createCursor(bytes, { recursiveReadLimit = 8192 } = {}) {
	const cursor = Object.create(staticCursor);
	cursor.bytes = bytes;
	cursor.dataView = new DataView(bytes.buffer ?? bytes, bytes.byteOffset, bytes.byteLength);
	cursor.positionReadCount = /* @__PURE__ */ new Map();
	cursor.recursiveReadLimit = recursiveReadLimit;
	return cursor;
}
//#endregion
//#region node_modules/viem/_esm/utils/encoding/fromBytes.js
/**
* Decodes a byte array into a bigint.
*
* - Docs: https://viem.sh/docs/utilities/fromBytes#bytestobigint
*
* @param bytes Byte array to decode.
* @param opts Options.
* @returns BigInt value.
*
* @example
* import { bytesToBigInt } from 'viem'
* const data = bytesToBigInt(new Uint8Array([1, 164]))
* // 420n
*/
function bytesToBigInt(bytes, opts = {}) {
	if (typeof opts.size !== "undefined") assertSize(bytes, { size: opts.size });
	return hexToBigInt(bytesToHex(bytes, opts), opts);
}
/**
* Decodes a byte array into a boolean.
*
* - Docs: https://viem.sh/docs/utilities/fromBytes#bytestobool
*
* @param bytes Byte array to decode.
* @param opts Options.
* @returns Boolean value.
*
* @example
* import { bytesToBool } from 'viem'
* const data = bytesToBool(new Uint8Array([1]))
* // true
*/
function bytesToBool(bytes_, opts = {}) {
	let bytes = bytes_;
	if (typeof opts.size !== "undefined") {
		assertSize(bytes, { size: opts.size });
		bytes = trim(bytes);
	}
	if (bytes.length > 1 || bytes[0] > 1) throw new InvalidBytesBooleanError(bytes);
	return Boolean(bytes[0]);
}
/**
* Decodes a byte array into a number.
*
* - Docs: https://viem.sh/docs/utilities/fromBytes#bytestonumber
*
* @param bytes Byte array to decode.
* @param opts Options.
* @returns Number value.
*
* @example
* import { bytesToNumber } from 'viem'
* const data = bytesToNumber(new Uint8Array([1, 164]))
* // 420
*/
function bytesToNumber(bytes, opts = {}) {
	if (typeof opts.size !== "undefined") assertSize(bytes, { size: opts.size });
	return hexToNumber(bytesToHex(bytes, opts), opts);
}
/**
* Decodes a byte array into a UTF-8 string.
*
* - Docs: https://viem.sh/docs/utilities/fromBytes#bytestostring
*
* @param bytes Byte array to decode.
* @param opts Options.
* @returns String value.
*
* @example
* import { bytesToString } from 'viem'
* const data = bytesToString(new Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33]))
* // 'Hello world'
*/
function bytesToString(bytes_, opts = {}) {
	let bytes = bytes_;
	if (typeof opts.size !== "undefined") {
		assertSize(bytes, { size: opts.size });
		bytes = trim(bytes, { dir: "right" });
	}
	return new TextDecoder().decode(bytes);
}
//#endregion
//#region node_modules/viem/_esm/utils/abi/decodeAbiParameters.js
function decodeAbiParameters(params, data) {
	const bytes = typeof data === "string" ? hexToBytes(data) : data;
	const cursor = createCursor(bytes);
	if (size$1(bytes) === 0 && params.length > 0) throw new AbiDecodingZeroDataError();
	if (size$1(data) && size$1(data) < 32) throw new AbiDecodingDataSizeTooSmallError({
		data: typeof data === "string" ? data : bytesToHex(data),
		params,
		size: size$1(data)
	});
	let consumed = 0;
	const values = [];
	for (let i = 0; i < params.length; ++i) {
		const param = params[i];
		cursor.setPosition(consumed);
		const [data, consumed_] = decodeParameter(cursor, param, { staticPosition: 0 });
		consumed += consumed_;
		values.push(data);
	}
	return values;
}
function decodeParameter(cursor, param, { staticPosition }) {
	const arrayComponents = getArrayComponents(param.type);
	if (arrayComponents) {
		const [length, type] = arrayComponents;
		return decodeArray(cursor, {
			...param,
			type
		}, {
			length,
			staticPosition
		});
	}
	if (param.type === "tuple") return decodeTuple(cursor, param, { staticPosition });
	if (param.type === "address") return decodeAddress(cursor);
	if (param.type === "bool") return decodeBool(cursor);
	if (param.type.startsWith("bytes")) return decodeBytes(cursor, param, { staticPosition });
	if (param.type.startsWith("uint") || param.type.startsWith("int")) return decodeNumber(cursor, param);
	if (param.type === "string") return decodeString(cursor, { staticPosition });
	throw new InvalidAbiDecodingTypeError(param.type, { docsPath: "/docs/contract/decodeAbiParameters" });
}
var sizeOfLength = 32;
var sizeOfOffset = 32;
function decodeAddress(cursor) {
	return [checksumAddress(bytesToHex(sliceBytes(cursor.readBytes(32), -20))), 32];
}
function decodeArray(cursor, param, { length, staticPosition }) {
	if (!length) {
		const start = staticPosition + bytesToNumber(cursor.readBytes(sizeOfOffset));
		const startOfData = start + sizeOfLength;
		cursor.setPosition(start);
		const length = bytesToNumber(cursor.readBytes(sizeOfLength));
		const dynamicChild = hasDynamicChild(param);
		let consumed = 0;
		const value = [];
		for (let i = 0; i < length; ++i) {
			cursor.setPosition(startOfData + (dynamicChild ? i * 32 : consumed));
			const [data, consumed_] = decodeParameter(cursor, param, { staticPosition: startOfData });
			consumed += consumed_;
			value.push(data);
		}
		cursor.setPosition(staticPosition + 32);
		return [value, 32];
	}
	if (hasDynamicChild(param)) {
		const start = staticPosition + bytesToNumber(cursor.readBytes(sizeOfOffset));
		const value = [];
		for (let i = 0; i < length; ++i) {
			cursor.setPosition(start + i * 32);
			const [data] = decodeParameter(cursor, param, { staticPosition: start });
			value.push(data);
		}
		cursor.setPosition(staticPosition + 32);
		return [value, 32];
	}
	let consumed = 0;
	const value = [];
	for (let i = 0; i < length; ++i) {
		const [data, consumed_] = decodeParameter(cursor, param, { staticPosition: staticPosition + consumed });
		consumed += consumed_;
		value.push(data);
	}
	return [value, consumed];
}
function decodeBool(cursor) {
	return [bytesToBool(cursor.readBytes(32), { size: 32 }), 32];
}
function decodeBytes(cursor, param, { staticPosition }) {
	const [_, size] = param.type.split("bytes");
	if (!size) {
		const offset = bytesToNumber(cursor.readBytes(32));
		cursor.setPosition(staticPosition + offset);
		const length = bytesToNumber(cursor.readBytes(32));
		if (length === 0) {
			cursor.setPosition(staticPosition + 32);
			return ["0x", 32];
		}
		const data = cursor.readBytes(length);
		cursor.setPosition(staticPosition + 32);
		return [bytesToHex(data), 32];
	}
	return [bytesToHex(cursor.readBytes(Number.parseInt(size, 10), 32)), 32];
}
function decodeNumber(cursor, param) {
	const signed = param.type.startsWith("int");
	const size = Number.parseInt(param.type.split("int")[1] || "256", 10);
	const value = cursor.readBytes(32);
	return [size > 48 ? bytesToBigInt(value, { signed }) : bytesToNumber(value, { signed }), 32];
}
function decodeTuple(cursor, param, { staticPosition }) {
	const hasUnnamedChild = param.components.length === 0 || param.components.some(({ name }) => !name);
	const value = hasUnnamedChild ? [] : {};
	let consumed = 0;
	if (hasDynamicChild(param)) {
		const start = staticPosition + bytesToNumber(cursor.readBytes(sizeOfOffset));
		for (let i = 0; i < param.components.length; ++i) {
			const component = param.components[i];
			cursor.setPosition(start + consumed);
			const [data, consumed_] = decodeParameter(cursor, component, { staticPosition: start });
			consumed += consumed_;
			value[hasUnnamedChild ? i : component?.name] = data;
		}
		cursor.setPosition(staticPosition + 32);
		return [value, 32];
	}
	for (let i = 0; i < param.components.length; ++i) {
		const component = param.components[i];
		const [data, consumed_] = decodeParameter(cursor, component, { staticPosition });
		value[hasUnnamedChild ? i : component?.name] = data;
		consumed += consumed_;
	}
	return [value, consumed];
}
function decodeString(cursor, { staticPosition }) {
	const start = staticPosition + bytesToNumber(cursor.readBytes(32));
	cursor.setPosition(start);
	const length = bytesToNumber(cursor.readBytes(32));
	if (length === 0) {
		cursor.setPosition(staticPosition + 32);
		return ["", 32];
	}
	const value = bytesToString(trim(cursor.readBytes(length, 32)));
	cursor.setPosition(staticPosition + 32);
	return [value, 32];
}
function hasDynamicChild(param) {
	const { type } = param;
	if (type === "string") return true;
	if (type === "bytes") return true;
	if (type.endsWith("[]")) return true;
	if (type === "tuple") return param.components?.some(hasDynamicChild);
	const arrayComponents = getArrayComponents(param.type);
	if (arrayComponents && hasDynamicChild({
		...param,
		type: arrayComponents[1]
	})) return true;
	return false;
}
//#endregion
//#region node_modules/viem/_esm/utils/abi/decodeErrorResult.js
function decodeErrorResult(parameters) {
	const { abi, data, cause } = parameters;
	const signature = slice(data, 0, 4);
	if (signature === "0x") throw new AbiDecodingZeroDataError({ cause });
	const abiItem = [
		...abi || [],
		solidityError,
		solidityPanic
	].find((x) => x.type === "error" && signature === toFunctionSelector(formatAbiItem(x)));
	if (!abiItem) throw new AbiErrorSignatureNotFoundError(signature, {
		docsPath: "/docs/contract/decodeErrorResult",
		cause
	});
	return {
		abiItem,
		args: "inputs" in abiItem && abiItem.inputs && abiItem.inputs.length > 0 ? decodeAbiParameters(abiItem.inputs, slice(data, 4)) : void 0,
		errorName: abiItem.name
	};
}
//#endregion
//#region node_modules/viem/_esm/utils/stringify.js
var stringify = (value, replacer, space) => JSON.stringify(value, (key, value_) => {
	const value = typeof value_ === "bigint" ? value_.toString() : value_;
	return typeof replacer === "function" ? replacer(key, value) : value;
}, space);
//#endregion
//#region node_modules/viem/_esm/utils/abi/formatAbiItemWithArgs.js
function formatAbiItemWithArgs({ abiItem, args, includeFunctionName = true, includeName = false }) {
	if (!("name" in abiItem)) return;
	if (!("inputs" in abiItem)) return;
	if (!abiItem.inputs) return;
	return `${includeFunctionName ? abiItem.name : ""}(${abiItem.inputs.map((input, i) => `${includeName && input.name ? `${input.name}: ` : ""}${typeof args[i] === "object" ? stringify(args[i]) : args[i]}`).join(", ")})`;
}
//#endregion
//#region node_modules/viem/_esm/constants/unit.js
var etherUnits = {
	gwei: 9,
	wei: 18
};
var gweiUnits = {
	ether: -9,
	wei: 9
};
//#endregion
//#region node_modules/viem/_esm/utils/unit/formatUnits.js
/**
*  Divides a number by a given exponent of base 10 (10exponent), and formats it into a string representation of the number..
*
* - Docs: https://viem.sh/docs/utilities/formatUnits
*
* @example
* import { formatUnits } from 'viem'
*
* formatUnits(420000000000n, 9)
* // '420'
*/
function formatUnits(value, decimals) {
	let display = value.toString();
	const negative = display.startsWith("-");
	if (negative) display = display.slice(1);
	display = display.padStart(decimals, "0");
	let [integer, fraction] = [display.slice(0, display.length - decimals), display.slice(display.length - decimals)];
	fraction = fraction.replace(/(0+)$/, "");
	return `${negative ? "-" : ""}${integer || "0"}${fraction ? `.${fraction}` : ""}`;
}
//#endregion
//#region node_modules/viem/_esm/utils/unit/formatEther.js
/**
* Converts numerical wei to a string representation of ether.
*
* - Docs: https://viem.sh/docs/utilities/formatEther
*
* @example
* import { formatEther } from 'viem'
*
* formatEther(1000000000000000000n)
* // '1'
*/
function formatEther(wei, unit = "wei") {
	return formatUnits(wei, etherUnits[unit]);
}
//#endregion
//#region node_modules/viem/_esm/utils/unit/formatGwei.js
/**
* Converts numerical wei to a string representation of gwei.
*
* - Docs: https://viem.sh/docs/utilities/formatGwei
*
* @example
* import { formatGwei } from 'viem'
*
* formatGwei(1000000000n)
* // '1'
*/
function formatGwei(wei, unit = "wei") {
	return formatUnits(wei, gweiUnits[unit]);
}
//#endregion
//#region node_modules/viem/_esm/errors/stateOverride.js
var AccountStateConflictError = class extends BaseError {
	constructor({ address }) {
		super(`State for account "${address}" is set multiple times.`, { name: "AccountStateConflictError" });
	}
};
var StateAssignmentConflictError = class extends BaseError {
	constructor() {
		super("state and stateDiff are set on the same account.", { name: "StateAssignmentConflictError" });
	}
};
//#endregion
//#region node_modules/viem/_esm/errors/transaction.js
function prettyPrint(args) {
	const entries = Object.entries(args).map(([key, value]) => {
		if (value === void 0 || value === false) return null;
		return [key, value];
	}).filter(Boolean);
	const maxLength = entries.reduce((acc, [key]) => Math.max(acc, key.length), 0);
	return entries.map(([key, value]) => `  ${`${key}:`.padEnd(maxLength + 1)}  ${value}`).join("\n");
}
var InvalidSerializableTransactionError = class extends BaseError {
	constructor({ transaction }) {
		super("Cannot infer a transaction type from provided transaction.", {
			metaMessages: [
				"Provided Transaction:",
				"{",
				prettyPrint(transaction),
				"}",
				"",
				"To infer the type, either provide:",
				"- a `type` to the Transaction, or",
				"- an EIP-1559 Transaction with `maxFeePerGas`, or",
				"- an EIP-2930 Transaction with `gasPrice` & `accessList`, or",
				"- an EIP-4844 Transaction with `blobs`, `blobVersionedHashes`, `sidecars`, or",
				"- an EIP-7702 Transaction with `authorizationList`, or",
				"- a Legacy Transaction with `gasPrice`"
			],
			name: "InvalidSerializableTransactionError"
		});
	}
};
var TransactionExecutionError = class extends BaseError {
	constructor(cause, { account, docsPath, chain, data, gas, gasPrice, maxFeePerGas, maxPriorityFeePerGas, nonce, to, value }) {
		const prettyArgs = prettyPrint({
			chain: chain && `${chain?.name} (id: ${chain?.id})`,
			from: account?.address,
			to,
			value: typeof value !== "undefined" && `${formatEther(value)} ${chain?.nativeCurrency?.symbol || "ETH"}`,
			data,
			gas,
			gasPrice: typeof gasPrice !== "undefined" && `${formatGwei(gasPrice)} gwei`,
			maxFeePerGas: typeof maxFeePerGas !== "undefined" && `${formatGwei(maxFeePerGas)} gwei`,
			maxPriorityFeePerGas: typeof maxPriorityFeePerGas !== "undefined" && `${formatGwei(maxPriorityFeePerGas)} gwei`,
			nonce
		});
		super(cause.shortMessage, {
			cause,
			docsPath,
			metaMessages: [
				...cause.metaMessages ? [...cause.metaMessages, " "] : [],
				"Request Arguments:",
				prettyArgs
			].filter(Boolean),
			name: "TransactionExecutionError"
		});
		Object.defineProperty(this, "cause", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		this.cause = cause;
	}
};
var TransactionNotFoundError = class extends BaseError {
	constructor({ blockHash, blockNumber, blockTag, hash, index }) {
		let identifier = "Transaction";
		if (blockTag && index !== void 0) identifier = `Transaction at block time "${blockTag}" at index "${index}"`;
		if (blockHash && index !== void 0) identifier = `Transaction at block hash "${blockHash}" at index "${index}"`;
		if (blockNumber && index !== void 0) identifier = `Transaction at block number "${blockNumber}" at index "${index}"`;
		if (hash) identifier = `Transaction with hash "${hash}"`;
		super(`${identifier} could not be found.`, { name: "TransactionNotFoundError" });
	}
};
var TransactionReceiptNotFoundError = class extends BaseError {
	constructor({ hash }) {
		super(`Transaction receipt with hash "${hash}" could not be found. The Transaction may not be processed on a block yet.`, { name: "TransactionReceiptNotFoundError" });
	}
};
var WaitForTransactionReceiptTimeoutError = class extends BaseError {
	constructor({ hash }) {
		super(`Timed out while waiting for transaction with hash "${hash}" to be confirmed.`, { name: "WaitForTransactionReceiptTimeoutError" });
	}
};
//#endregion
//#region node_modules/viem/_esm/errors/utils.js
var getContractAddress = (address) => address;
function getAbortError(signal) {
	if (signal?.reason) return signal.reason;
	if (typeof DOMException === "function") return new DOMException("This operation was aborted", "AbortError");
	const error = /* @__PURE__ */ new Error("This operation was aborted");
	error.name = "AbortError";
	return error;
}
function isAbortError(error) {
	return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}
/**
* Returns the URL with any embedded basic-auth credentials stripped, so
* error messages and logs don't leak secrets when an RPC URL like
* `https://user:pass@host` is used.
*/
var getUrl = (url) => {
	try {
		const parsed = new URL(url);
		if (!parsed.username && !parsed.password) return url;
		parsed.username = "";
		parsed.password = "";
		return parsed.toString();
	} catch {
		return url;
	}
};
//#endregion
//#region node_modules/viem/_esm/errors/contract.js
var ContractFunctionExecutionError = class extends BaseError {
	constructor(cause, { abi, args, contractAddress, docsPath, functionName, sender }) {
		const abiItem = getAbiItem({
			abi,
			args,
			name: functionName
		});
		const formattedArgs = abiItem ? formatAbiItemWithArgs({
			abiItem,
			args,
			includeFunctionName: false,
			includeName: false
		}) : void 0;
		const functionWithParams = abiItem ? formatAbiItem(abiItem, { includeName: true }) : void 0;
		const prettyArgs = prettyPrint({
			address: contractAddress && getContractAddress(contractAddress),
			function: functionWithParams,
			args: formattedArgs && formattedArgs !== "()" && `${[...Array(functionName?.length ?? 0).keys()].map(() => " ").join("")}${formattedArgs}`,
			sender
		});
		super(cause.shortMessage || `An unknown error occurred while executing the contract function "${functionName}".`, {
			cause,
			docsPath,
			metaMessages: [
				...cause.metaMessages ? [...cause.metaMessages, " "] : [],
				prettyArgs && "Contract Call:",
				prettyArgs
			].filter(Boolean),
			name: "ContractFunctionExecutionError"
		});
		Object.defineProperty(this, "abi", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "args", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "cause", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "contractAddress", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "formattedArgs", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "functionName", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "sender", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		this.abi = abi;
		this.args = args;
		this.cause = cause;
		this.contractAddress = contractAddress;
		this.functionName = functionName;
		this.sender = sender;
	}
};
var ContractFunctionRevertedError = class extends BaseError {
	constructor({ abi, data, functionName, message, cause: error }) {
		let cause;
		let decodedData;
		let metaMessages;
		let reason;
		if (data && data !== "0x") try {
			decodedData = decodeErrorResult({
				abi,
				data,
				cause: error
			});
			const { abiItem, errorName, args: errorArgs } = decodedData;
			if (errorName === "Error") reason = errorArgs[0];
			else if (errorName === "Panic") {
				const [firstArg] = errorArgs;
				reason = panicReasons[firstArg];
			} else {
				const errorWithParams = abiItem ? formatAbiItem(abiItem, { includeName: true }) : void 0;
				const formattedArgs = abiItem && errorArgs ? formatAbiItemWithArgs({
					abiItem,
					args: errorArgs,
					includeFunctionName: false,
					includeName: false
				}) : void 0;
				metaMessages = [errorWithParams ? `Error: ${errorWithParams}` : "", formattedArgs && formattedArgs !== "()" ? `       ${[...Array(errorName?.length ?? 0).keys()].map(() => " ").join("")}${formattedArgs}` : ""];
			}
		} catch (err) {
			cause = err;
		}
		else if (message) reason = message;
		let signature;
		if (cause instanceof AbiErrorSignatureNotFoundError) {
			signature = cause.signature;
			metaMessages = [
				`Unable to decode signature "${signature}" as it was not found on the provided ABI.`,
				"Make sure you are using the correct ABI and that the error exists on it.",
				`You can look up the decoded signature here: https://4byte.sourcify.dev/?q=${signature}.`
			];
		}
		super(reason && reason !== "execution reverted" || signature ? [`The contract function "${functionName}" reverted with the following ${signature ? "signature" : "reason"}:`, reason || signature].join("\n") : `The contract function "${functionName}" reverted.`, {
			cause: cause ?? error,
			metaMessages,
			name: "ContractFunctionRevertedError"
		});
		Object.defineProperty(this, "data", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "raw", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "reason", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "signature", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		this.data = decodedData;
		this.raw = data;
		this.reason = reason;
		this.signature = signature;
	}
};
var ContractFunctionZeroDataError = class extends BaseError {
	constructor({ functionName, cause }) {
		super(`The contract function "${functionName}" returned no data ("0x").`, {
			metaMessages: [
				"This could be due to any of the following:",
				`  - The contract does not have the function "${functionName}",`,
				"  - The parameters passed to the contract function may be invalid, or",
				"  - The address is not a contract."
			],
			name: "ContractFunctionZeroDataError",
			cause
		});
	}
};
var RawContractError = class extends BaseError {
	constructor({ data, message }) {
		super(message || "", { name: "RawContractError" });
		Object.defineProperty(this, "code", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: 3
		});
		Object.defineProperty(this, "data", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		this.data = data;
	}
};
//#endregion
//#region node_modules/viem/_esm/errors/request.js
var HttpRequestError = class extends BaseError {
	constructor({ body, cause, details, headers, status, url }) {
		super("HTTP request failed.", {
			cause,
			details,
			metaMessages: [
				status && `Status: ${status}`,
				`URL: ${getUrl(url)}`,
				body && `Request body: ${stringify(body)}`
			].filter(Boolean),
			name: "HttpRequestError"
		});
		Object.defineProperty(this, "body", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "headers", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "status", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "url", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		this.body = body;
		this.headers = headers;
		this.status = status;
		this.url = url;
	}
};
var RpcRequestError = class extends BaseError {
	constructor({ body, error, url }) {
		super("RPC Request failed.", {
			cause: error,
			details: error.message,
			metaMessages: [`URL: ${getUrl(url)}`, `Request body: ${stringify(body)}`],
			name: "RpcRequestError"
		});
		Object.defineProperty(this, "code", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "data", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "url", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		this.code = error.code;
		this.data = error.data;
		this.url = url;
	}
};
var TimeoutError = class extends BaseError {
	constructor({ body, url }) {
		super("The request took too long to respond.", {
			details: "The request timed out.",
			metaMessages: [`URL: ${getUrl(url)}`, `Request body: ${stringify(body)}`],
			name: "TimeoutError"
		});
		Object.defineProperty(this, "url", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		this.url = url;
	}
};
//#endregion
//#region node_modules/viem/_esm/errors/rpc.js
var unknownErrorCode = -1;
var RpcError = class extends BaseError {
	constructor(cause, { code, docsPath, metaMessages, name, shortMessage }) {
		super(shortMessage, {
			cause,
			docsPath,
			metaMessages: metaMessages || cause?.metaMessages,
			name: name || "RpcError"
		});
		Object.defineProperty(this, "code", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		this.name = name || cause.name;
		this.code = cause instanceof RpcRequestError ? cause.code : code ?? unknownErrorCode;
	}
};
var ProviderRpcError = class extends RpcError {
	constructor(cause, options) {
		super(cause, options);
		Object.defineProperty(this, "data", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		this.data = options.data;
	}
};
var ParseRpcError = class ParseRpcError extends RpcError {
	constructor(cause) {
		super(cause, {
			code: ParseRpcError.code,
			name: "ParseRpcError",
			shortMessage: "Invalid JSON was received by the server. An error occurred on the server while parsing the JSON text."
		});
	}
};
Object.defineProperty(ParseRpcError, "code", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: -32700
});
var InvalidRequestRpcError = class InvalidRequestRpcError extends RpcError {
	constructor(cause) {
		super(cause, {
			code: InvalidRequestRpcError.code,
			name: "InvalidRequestRpcError",
			shortMessage: "JSON is not a valid request object."
		});
	}
};
Object.defineProperty(InvalidRequestRpcError, "code", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: -32600
});
var MethodNotFoundRpcError = class MethodNotFoundRpcError extends RpcError {
	constructor(cause, { method } = {}) {
		super(cause, {
			code: MethodNotFoundRpcError.code,
			name: "MethodNotFoundRpcError",
			shortMessage: `The method${method ? ` "${method}"` : ""} does not exist / is not available.`
		});
	}
};
Object.defineProperty(MethodNotFoundRpcError, "code", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: -32601
});
var InvalidParamsRpcError = class InvalidParamsRpcError extends RpcError {
	constructor(cause) {
		super(cause, {
			code: InvalidParamsRpcError.code,
			name: "InvalidParamsRpcError",
			shortMessage: ["Invalid parameters were provided to the RPC method.", "Double check you have provided the correct parameters."].join("\n")
		});
	}
};
Object.defineProperty(InvalidParamsRpcError, "code", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: -32602
});
var InternalRpcError = class InternalRpcError extends RpcError {
	constructor(cause) {
		super(cause, {
			code: InternalRpcError.code,
			name: "InternalRpcError",
			shortMessage: "An internal error was received."
		});
	}
};
Object.defineProperty(InternalRpcError, "code", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: -32603
});
var InvalidInputRpcError = class InvalidInputRpcError extends RpcError {
	constructor(cause) {
		super(cause, {
			code: InvalidInputRpcError.code,
			name: "InvalidInputRpcError",
			shortMessage: ["Missing or invalid parameters.", "Double check you have provided the correct parameters."].join("\n")
		});
	}
};
Object.defineProperty(InvalidInputRpcError, "code", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: -32e3
});
var ResourceNotFoundRpcError = class ResourceNotFoundRpcError extends RpcError {
	constructor(cause) {
		super(cause, {
			code: ResourceNotFoundRpcError.code,
			name: "ResourceNotFoundRpcError",
			shortMessage: "Requested resource not found."
		});
		Object.defineProperty(this, "name", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: "ResourceNotFoundRpcError"
		});
	}
};
Object.defineProperty(ResourceNotFoundRpcError, "code", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: -32001
});
var ResourceUnavailableRpcError = class ResourceUnavailableRpcError extends RpcError {
	constructor(cause) {
		super(cause, {
			code: ResourceUnavailableRpcError.code,
			name: "ResourceUnavailableRpcError",
			shortMessage: "Requested resource not available."
		});
	}
};
Object.defineProperty(ResourceUnavailableRpcError, "code", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: -32002
});
var TransactionRejectedRpcError = class TransactionRejectedRpcError extends RpcError {
	constructor(cause) {
		super(cause, {
			code: TransactionRejectedRpcError.code,
			name: "TransactionRejectedRpcError",
			shortMessage: "Transaction creation failed."
		});
	}
};
Object.defineProperty(TransactionRejectedRpcError, "code", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: -32003
});
var MethodNotSupportedRpcError = class MethodNotSupportedRpcError extends RpcError {
	constructor(cause, { method } = {}) {
		super(cause, {
			code: MethodNotSupportedRpcError.code,
			name: "MethodNotSupportedRpcError",
			shortMessage: `Method${method ? ` "${method}"` : ""} is not supported.`
		});
	}
};
Object.defineProperty(MethodNotSupportedRpcError, "code", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: -32004
});
var LimitExceededRpcError = class LimitExceededRpcError extends RpcError {
	constructor(cause) {
		super(cause, {
			code: LimitExceededRpcError.code,
			name: "LimitExceededRpcError",
			shortMessage: "Request exceeds defined limit."
		});
	}
};
Object.defineProperty(LimitExceededRpcError, "code", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: -32005
});
var JsonRpcVersionUnsupportedError = class JsonRpcVersionUnsupportedError extends RpcError {
	constructor(cause) {
		super(cause, {
			code: JsonRpcVersionUnsupportedError.code,
			name: "JsonRpcVersionUnsupportedError",
			shortMessage: "Version of JSON-RPC protocol is not supported."
		});
	}
};
Object.defineProperty(JsonRpcVersionUnsupportedError, "code", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: -32006
});
var UserRejectedRequestError = class UserRejectedRequestError extends ProviderRpcError {
	constructor(cause) {
		super(cause, {
			code: UserRejectedRequestError.code,
			name: "UserRejectedRequestError",
			shortMessage: "User rejected the request."
		});
	}
};
Object.defineProperty(UserRejectedRequestError, "code", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: 4001
});
var UnauthorizedProviderError = class UnauthorizedProviderError extends ProviderRpcError {
	constructor(cause) {
		super(cause, {
			code: UnauthorizedProviderError.code,
			name: "UnauthorizedProviderError",
			shortMessage: "The requested method and/or account has not been authorized by the user."
		});
	}
};
Object.defineProperty(UnauthorizedProviderError, "code", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: 4100
});
var UnsupportedProviderMethodError = class UnsupportedProviderMethodError extends ProviderRpcError {
	constructor(cause, { method } = {}) {
		super(cause, {
			code: UnsupportedProviderMethodError.code,
			name: "UnsupportedProviderMethodError",
			shortMessage: `The Provider does not support the requested method${method ? ` " ${method}"` : ""}.`
		});
	}
};
Object.defineProperty(UnsupportedProviderMethodError, "code", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: 4200
});
var ProviderDisconnectedError = class ProviderDisconnectedError extends ProviderRpcError {
	constructor(cause) {
		super(cause, {
			code: ProviderDisconnectedError.code,
			name: "ProviderDisconnectedError",
			shortMessage: "The Provider is disconnected from all chains."
		});
	}
};
Object.defineProperty(ProviderDisconnectedError, "code", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: 4900
});
var ChainDisconnectedError = class ChainDisconnectedError extends ProviderRpcError {
	constructor(cause) {
		super(cause, {
			code: ChainDisconnectedError.code,
			name: "ChainDisconnectedError",
			shortMessage: "The Provider is not connected to the requested chain."
		});
	}
};
Object.defineProperty(ChainDisconnectedError, "code", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: 4901
});
var SwitchChainError = class SwitchChainError extends ProviderRpcError {
	constructor(cause) {
		super(cause, {
			code: SwitchChainError.code,
			name: "SwitchChainError",
			shortMessage: "An error occurred when attempting to switch chain."
		});
	}
};
Object.defineProperty(SwitchChainError, "code", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: 4902
});
var UnsupportedNonOptionalCapabilityError = class UnsupportedNonOptionalCapabilityError extends ProviderRpcError {
	constructor(cause) {
		super(cause, {
			code: UnsupportedNonOptionalCapabilityError.code,
			name: "UnsupportedNonOptionalCapabilityError",
			shortMessage: "This Wallet does not support a capability that was not marked as optional."
		});
	}
};
Object.defineProperty(UnsupportedNonOptionalCapabilityError, "code", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: 5700
});
var UnsupportedChainIdError = class UnsupportedChainIdError extends ProviderRpcError {
	constructor(cause) {
		super(cause, {
			code: UnsupportedChainIdError.code,
			name: "UnsupportedChainIdError",
			shortMessage: "This Wallet does not support the requested chain ID."
		});
	}
};
Object.defineProperty(UnsupportedChainIdError, "code", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: 5710
});
var DuplicateIdError = class DuplicateIdError extends ProviderRpcError {
	constructor(cause) {
		super(cause, {
			code: DuplicateIdError.code,
			name: "DuplicateIdError",
			shortMessage: "There is already a bundle submitted with this ID."
		});
	}
};
Object.defineProperty(DuplicateIdError, "code", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: 5720
});
var UnknownBundleIdError = class UnknownBundleIdError extends ProviderRpcError {
	constructor(cause) {
		super(cause, {
			code: UnknownBundleIdError.code,
			name: "UnknownBundleIdError",
			shortMessage: "This bundle id is unknown / has not been submitted"
		});
	}
};
Object.defineProperty(UnknownBundleIdError, "code", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: 5730
});
var BundleTooLargeError = class BundleTooLargeError extends ProviderRpcError {
	constructor(cause) {
		super(cause, {
			code: BundleTooLargeError.code,
			name: "BundleTooLargeError",
			shortMessage: "The call bundle is too large for the Wallet to process."
		});
	}
};
Object.defineProperty(BundleTooLargeError, "code", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: 5740
});
var AtomicReadyWalletRejectedUpgradeError = class AtomicReadyWalletRejectedUpgradeError extends ProviderRpcError {
	constructor(cause) {
		super(cause, {
			code: AtomicReadyWalletRejectedUpgradeError.code,
			name: "AtomicReadyWalletRejectedUpgradeError",
			shortMessage: "The Wallet can support atomicity after an upgrade, but the user rejected the upgrade."
		});
	}
};
Object.defineProperty(AtomicReadyWalletRejectedUpgradeError, "code", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: 5750
});
var AtomicityNotSupportedError = class AtomicityNotSupportedError extends ProviderRpcError {
	constructor(cause) {
		super(cause, {
			code: AtomicityNotSupportedError.code,
			name: "AtomicityNotSupportedError",
			shortMessage: "The wallet does not support atomic execution but the request requires it."
		});
	}
};
Object.defineProperty(AtomicityNotSupportedError, "code", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: 5760
});
var WalletConnectSessionSettlementError = class WalletConnectSessionSettlementError extends ProviderRpcError {
	constructor(cause) {
		super(cause, {
			code: WalletConnectSessionSettlementError.code,
			name: "WalletConnectSessionSettlementError",
			shortMessage: "WalletConnect session settlement failed."
		});
	}
};
Object.defineProperty(WalletConnectSessionSettlementError, "code", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: 7e3
});
var UnknownRpcError = class extends RpcError {
	constructor(cause) {
		super(cause, {
			name: "UnknownRpcError",
			shortMessage: "An unknown RPC error occurred."
		});
	}
};
//#endregion
//#region node_modules/viem/_esm/utils/errors/getContractError.js
var EXECUTION_REVERTED_ERROR_CODE = 3;
function getContractError(err, { abi, address, args, docsPath, functionName, sender }) {
	const error = err instanceof RawContractError ? err : err instanceof BaseError ? err.walk((err) => "data" in err) || err.walk() : {};
	const { code, data, details, message, shortMessage } = error;
	return new ContractFunctionExecutionError((() => {
		if (err instanceof AbiDecodingZeroDataError) return new ContractFunctionZeroDataError({
			functionName,
			cause: err
		});
		if ([EXECUTION_REVERTED_ERROR_CODE, InternalRpcError.code].includes(code) && (data || details || message || shortMessage) || code === InvalidInputRpcError.code && details === "execution reverted" && data) return new ContractFunctionRevertedError({
			abi,
			data: typeof data === "object" ? data.data : data,
			functionName,
			message: error instanceof RpcRequestError ? details : shortMessage ?? message,
			cause: err
		});
		return err;
	})(), {
		abi,
		args,
		contractAddress: address,
		docsPath,
		functionName,
		sender
	});
}
//#endregion
//#region node_modules/viem/_esm/accounts/utils/publicKeyToAddress.js
/**
* @description Converts an ECDSA public key to an address.
*
* @param publicKey The public key to convert.
*
* @returns The address.
*/
function publicKeyToAddress(publicKey) {
	return checksumAddress(`0x${keccak256(`0x${publicKey.substring(4)}`).substring(26)}`);
}
//#endregion
//#region node_modules/viem/_esm/utils/signature/recoverPublicKey.js
async function recoverPublicKey({ hash, signature }) {
	const hashHex = isHex(hash) ? hash : toHex(hash);
	const { secp256k1 } = await import("./secp256k1-DsytSS5v.js");
	return `0x${(() => {
		if (typeof signature === "object" && "r" in signature && "s" in signature) {
			const { r, s, v, yParity } = signature;
			const recoveryBit = toRecoveryBit(Number(yParity ?? v));
			return new secp256k1.Signature(hexToBigInt(r), hexToBigInt(s)).addRecoveryBit(recoveryBit);
		}
		const signatureHex = isHex(signature) ? signature : toHex(signature);
		if (size$1(signatureHex) !== 65) throw new Error("invalid signature length");
		const recoveryBit = toRecoveryBit(hexToNumber(`0x${signatureHex.slice(130)}`));
		return secp256k1.Signature.fromCompact(signatureHex.substring(2, 130)).addRecoveryBit(recoveryBit);
	})().recoverPublicKey(hashHex.substring(2)).toHex(false)}`;
}
function toRecoveryBit(yParityOrV) {
	if (yParityOrV === 0 || yParityOrV === 1) return yParityOrV;
	if (yParityOrV === 27) return 0;
	if (yParityOrV === 28) return 1;
	throw new Error("Invalid yParityOrV value");
}
//#endregion
//#region node_modules/viem/_esm/utils/signature/recoverAddress.js
async function recoverAddress({ hash, signature }) {
	return publicKeyToAddress(await recoverPublicKey({
		hash,
		signature
	}));
}
//#endregion
//#region node_modules/viem/_esm/utils/encoding/toRlp.js
function toRlp(bytes, to = "hex") {
	const encodable = getEncodable(bytes);
	const cursor = createCursor(new Uint8Array(encodable.length));
	encodable.encode(cursor);
	if (to === "hex") return bytesToHex(cursor.bytes);
	return cursor.bytes;
}
function getEncodable(bytes) {
	if (Array.isArray(bytes)) return getEncodableList(bytes.map((x) => getEncodable(x)));
	return getEncodableBytes(bytes);
}
function getEncodableList(list) {
	const bodyLength = list.reduce((acc, x) => acc + x.length, 0);
	const sizeOfBodyLength = getSizeOfLength(bodyLength);
	return {
		length: (() => {
			if (bodyLength <= 55) return 1 + bodyLength;
			return 1 + sizeOfBodyLength + bodyLength;
		})(),
		encode(cursor) {
			if (bodyLength <= 55) cursor.pushByte(192 + bodyLength);
			else {
				cursor.pushByte(247 + sizeOfBodyLength);
				if (sizeOfBodyLength === 1) cursor.pushUint8(bodyLength);
				else if (sizeOfBodyLength === 2) cursor.pushUint16(bodyLength);
				else if (sizeOfBodyLength === 3) cursor.pushUint24(bodyLength);
				else cursor.pushUint32(bodyLength);
			}
			for (const { encode } of list) encode(cursor);
		}
	};
}
function getEncodableBytes(bytesOrHex) {
	const bytes = typeof bytesOrHex === "string" ? hexToBytes(bytesOrHex) : bytesOrHex;
	const sizeOfBytesLength = getSizeOfLength(bytes.length);
	return {
		length: (() => {
			if (bytes.length === 1 && bytes[0] < 128) return 1;
			if (bytes.length <= 55) return 1 + bytes.length;
			return 1 + sizeOfBytesLength + bytes.length;
		})(),
		encode(cursor) {
			if (bytes.length === 1 && bytes[0] < 128) cursor.pushBytes(bytes);
			else if (bytes.length <= 55) {
				cursor.pushByte(128 + bytes.length);
				cursor.pushBytes(bytes);
			} else {
				cursor.pushByte(183 + sizeOfBytesLength);
				if (sizeOfBytesLength === 1) cursor.pushUint8(bytes.length);
				else if (sizeOfBytesLength === 2) cursor.pushUint16(bytes.length);
				else if (sizeOfBytesLength === 3) cursor.pushUint24(bytes.length);
				else cursor.pushUint32(bytes.length);
				cursor.pushBytes(bytes);
			}
		}
	};
}
function getSizeOfLength(length) {
	if (length < 2 ** 8) return 1;
	if (length < 2 ** 16) return 2;
	if (length < 2 ** 24) return 3;
	if (length < 2 ** 32) return 4;
	throw new BaseError("Length is too large.");
}
//#endregion
//#region node_modules/viem/_esm/utils/authorization/hashAuthorization.js
/**
* Computes an Authorization hash in [EIP-7702 format](https://eips.ethereum.org/EIPS/eip-7702): `keccak256('0x05' || rlp([chain_id, address, nonce]))`.
*/
function hashAuthorization(parameters) {
	const { chainId, nonce, to } = parameters;
	const address = parameters.contractAddress ?? parameters.address;
	const hash = keccak256(concatHex(["0x05", toRlp([
		chainId ? numberToHex(chainId) : "0x",
		address,
		nonce ? numberToHex(nonce) : "0x"
	])]));
	if (to === "bytes") return hexToBytes(hash);
	return hash;
}
//#endregion
//#region node_modules/viem/_esm/utils/authorization/recoverAuthorizationAddress.js
async function recoverAuthorizationAddress(parameters) {
	const { authorization, signature } = parameters;
	return recoverAddress({
		hash: hashAuthorization(authorization),
		signature: signature ?? authorization
	});
}
//#endregion
//#region node_modules/viem/_esm/errors/estimateGas.js
var EstimateGasExecutionError = class extends BaseError {
	constructor(cause, { account, docsPath, chain, data, gas, gasPrice, maxFeePerGas, maxPriorityFeePerGas, nonce, to, value }) {
		const prettyArgs = prettyPrint({
			from: account?.address,
			to,
			value: typeof value !== "undefined" && `${formatEther(value)} ${chain?.nativeCurrency?.symbol || "ETH"}`,
			data,
			gas,
			gasPrice: typeof gasPrice !== "undefined" && `${formatGwei(gasPrice)} gwei`,
			maxFeePerGas: typeof maxFeePerGas !== "undefined" && `${formatGwei(maxFeePerGas)} gwei`,
			maxPriorityFeePerGas: typeof maxPriorityFeePerGas !== "undefined" && `${formatGwei(maxPriorityFeePerGas)} gwei`,
			nonce
		});
		super(cause.shortMessage, {
			cause,
			docsPath,
			metaMessages: [
				...cause.metaMessages ? [...cause.metaMessages, " "] : [],
				"Estimate Gas Arguments:",
				prettyArgs
			].filter(Boolean),
			name: "EstimateGasExecutionError"
		});
		Object.defineProperty(this, "cause", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		this.cause = cause;
	}
};
//#endregion
//#region node_modules/viem/_esm/errors/node.js
var ExecutionRevertedError = class extends BaseError {
	constructor({ cause, message } = {}) {
		const reason = message?.replace("execution reverted: ", "")?.replace("execution reverted", "");
		super(`Execution reverted ${reason ? `with reason: ${reason}` : "for an unknown reason"}.`, {
			cause,
			name: "ExecutionRevertedError"
		});
	}
};
Object.defineProperty(ExecutionRevertedError, "code", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: 3
});
Object.defineProperty(ExecutionRevertedError, "nodeMessage", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: /execution reverted|gas required exceeds allowance/
});
var FeeCapTooHighError = class extends BaseError {
	constructor({ cause, maxFeePerGas } = {}) {
		super(`The fee cap (\`maxFeePerGas\`${maxFeePerGas ? ` = ${formatGwei(maxFeePerGas)} gwei` : ""}) cannot be higher than the maximum allowed value (2^256-1).`, {
			cause,
			name: "FeeCapTooHighError"
		});
	}
};
Object.defineProperty(FeeCapTooHighError, "nodeMessage", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: /max fee per gas higher than 2\^256-1|fee cap higher than 2\^256-1/
});
var FeeCapTooLowError = class extends BaseError {
	constructor({ cause, maxFeePerGas } = {}) {
		super(`The fee cap (\`maxFeePerGas\`${maxFeePerGas ? ` = ${formatGwei(maxFeePerGas)}` : ""} gwei) cannot be lower than the block base fee.`, {
			cause,
			name: "FeeCapTooLowError"
		});
	}
};
Object.defineProperty(FeeCapTooLowError, "nodeMessage", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: /max fee per gas less than block base fee|fee cap less than block base fee|transaction is outdated/
});
var NonceTooHighError = class extends BaseError {
	constructor({ cause, nonce } = {}) {
		super(`Nonce provided for the transaction ${nonce ? `(${nonce}) ` : ""}is higher than the next one expected.`, {
			cause,
			name: "NonceTooHighError"
		});
	}
};
Object.defineProperty(NonceTooHighError, "nodeMessage", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: /nonce too high/
});
var NonceTooLowError = class extends BaseError {
	constructor({ cause, nonce } = {}) {
		super([`Nonce provided for the transaction ${nonce ? `(${nonce}) ` : ""}is lower than the current nonce of the account.`, "Try increasing the nonce or find the latest nonce with `getTransactionCount`."].join("\n"), {
			cause,
			name: "NonceTooLowError"
		});
	}
};
Object.defineProperty(NonceTooLowError, "nodeMessage", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: /nonce too low|transaction already imported|already known/
});
var NonceMaxValueError = class extends BaseError {
	constructor({ cause, nonce } = {}) {
		super(`Nonce provided for the transaction ${nonce ? `(${nonce}) ` : ""}exceeds the maximum allowed nonce.`, {
			cause,
			name: "NonceMaxValueError"
		});
	}
};
Object.defineProperty(NonceMaxValueError, "nodeMessage", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: /nonce has max value/
});
var InsufficientFundsError = class extends BaseError {
	constructor({ cause } = {}) {
		super(["The total cost (gas * gas fee + value) of executing this transaction exceeds the balance of the account."].join("\n"), {
			cause,
			metaMessages: [
				"This error could arise when the account does not have enough funds to:",
				" - pay for the total gas fee,",
				" - pay for the value to send.",
				" ",
				"The cost of the transaction is calculated as `gas * gas fee + value`, where:",
				" - `gas` is the amount of gas needed for transaction to execute,",
				" - `gas fee` is the gas fee,",
				" - `value` is the amount of ether to send to the recipient."
			],
			name: "InsufficientFundsError"
		});
	}
};
Object.defineProperty(InsufficientFundsError, "nodeMessage", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: /insufficient funds|exceeds transaction sender account balance/
});
var IntrinsicGasTooHighError = class extends BaseError {
	constructor({ cause, gas } = {}) {
		super(`The amount of gas ${gas ? `(${gas}) ` : ""}provided for the transaction exceeds the limit allowed for the block.`, {
			cause,
			name: "IntrinsicGasTooHighError"
		});
	}
};
Object.defineProperty(IntrinsicGasTooHighError, "nodeMessage", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: /intrinsic gas too high|gas limit reached/
});
var IntrinsicGasTooLowError = class extends BaseError {
	constructor({ cause, gas } = {}) {
		super(`The amount of gas ${gas ? `(${gas}) ` : ""}provided for the transaction is too low.`, {
			cause,
			name: "IntrinsicGasTooLowError"
		});
	}
};
Object.defineProperty(IntrinsicGasTooLowError, "nodeMessage", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: /intrinsic gas too low/
});
var TransactionTypeNotSupportedError = class extends BaseError {
	constructor({ cause }) {
		super("The transaction type is not supported for this chain.", {
			cause,
			name: "TransactionTypeNotSupportedError"
		});
	}
};
Object.defineProperty(TransactionTypeNotSupportedError, "nodeMessage", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: /transaction type not valid/
});
var TipAboveFeeCapError = class extends BaseError {
	constructor({ cause, maxPriorityFeePerGas, maxFeePerGas } = {}) {
		super([`The provided tip (\`maxPriorityFeePerGas\`${maxPriorityFeePerGas ? ` = ${formatGwei(maxPriorityFeePerGas)} gwei` : ""}) cannot be higher than the fee cap (\`maxFeePerGas\`${maxFeePerGas ? ` = ${formatGwei(maxFeePerGas)} gwei` : ""}).`].join("\n"), {
			cause,
			name: "TipAboveFeeCapError"
		});
	}
};
Object.defineProperty(TipAboveFeeCapError, "nodeMessage", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: /max priority fee per gas higher than max fee per gas|tip higher than fee cap/
});
var UnknownNodeError = class extends BaseError {
	constructor({ cause }) {
		super(`An error occurred while executing: ${cause?.shortMessage}`, {
			cause,
			name: "UnknownNodeError"
		});
	}
};
//#endregion
//#region node_modules/viem/_esm/utils/errors/getNodeError.js
function getNodeError(err, args) {
	const message = (err.details || "").toLowerCase();
	const executionRevertedError = err instanceof BaseError ? err.walk((e) => e?.code === ExecutionRevertedError.code) : err;
	if (executionRevertedError instanceof BaseError) return new ExecutionRevertedError({
		cause: err,
		message: executionRevertedError.details
	});
	if (ExecutionRevertedError.nodeMessage.test(message)) return new ExecutionRevertedError({
		cause: err,
		message: err.details
	});
	if (FeeCapTooHighError.nodeMessage.test(message)) return new FeeCapTooHighError({
		cause: err,
		maxFeePerGas: args?.maxFeePerGas
	});
	if (FeeCapTooLowError.nodeMessage.test(message)) return new FeeCapTooLowError({
		cause: err,
		maxFeePerGas: args?.maxFeePerGas
	});
	if (NonceTooHighError.nodeMessage.test(message)) return new NonceTooHighError({
		cause: err,
		nonce: args?.nonce
	});
	if (NonceTooLowError.nodeMessage.test(message)) return new NonceTooLowError({
		cause: err,
		nonce: args?.nonce
	});
	if (NonceMaxValueError.nodeMessage.test(message)) return new NonceMaxValueError({
		cause: err,
		nonce: args?.nonce
	});
	if (InsufficientFundsError.nodeMessage.test(message)) return new InsufficientFundsError({ cause: err });
	if (IntrinsicGasTooHighError.nodeMessage.test(message)) return new IntrinsicGasTooHighError({
		cause: err,
		gas: args?.gas
	});
	if (IntrinsicGasTooLowError.nodeMessage.test(message)) return new IntrinsicGasTooLowError({
		cause: err,
		gas: args?.gas
	});
	if (TransactionTypeNotSupportedError.nodeMessage.test(message)) return new TransactionTypeNotSupportedError({ cause: err });
	if (TipAboveFeeCapError.nodeMessage.test(message)) return new TipAboveFeeCapError({
		cause: err,
		maxFeePerGas: args?.maxFeePerGas,
		maxPriorityFeePerGas: args?.maxPriorityFeePerGas
	});
	return new UnknownNodeError({ cause: err });
}
//#endregion
//#region node_modules/viem/_esm/utils/errors/getEstimateGasError.js
function getEstimateGasError(err, { docsPath, ...args }) {
	return new EstimateGasExecutionError((() => {
		const cause = getNodeError(err, args);
		if (cause instanceof UnknownNodeError) return err;
		return cause;
	})(), {
		docsPath,
		...args
	});
}
//#endregion
//#region node_modules/viem/_esm/utils/formatters/extract.js
/**
* @description Picks out the keys from `value` that exist in the formatter..
*/
function extract(value_, { format }) {
	if (!format) return {};
	const value = {};
	function extract_(formatted) {
		const keys = Object.keys(formatted);
		for (const key of keys) {
			if (key in value_) value[key] = value_[key];
			if (formatted[key] && typeof formatted[key] === "object" && !Array.isArray(formatted[key])) extract_(formatted[key]);
		}
	}
	extract_(format(value_ || {}));
	return value;
}
//#endregion
//#region node_modules/viem/_esm/utils/formatters/transactionRequest.js
var rpcTransactionType = {
	legacy: "0x0",
	eip2930: "0x1",
	eip1559: "0x2",
	eip4844: "0x3",
	eip7702: "0x4"
};
function formatTransactionRequest(request, _) {
	const rpcRequest = {};
	if (typeof request.authorizationList !== "undefined") rpcRequest.authorizationList = formatAuthorizationList$1(request.authorizationList);
	if (typeof request.accessList !== "undefined") rpcRequest.accessList = request.accessList;
	if (typeof request.blobVersionedHashes !== "undefined") rpcRequest.blobVersionedHashes = request.blobVersionedHashes;
	if (typeof request.blobs !== "undefined") if (typeof request.blobs[0] !== "string") rpcRequest.blobs = request.blobs.map((x) => bytesToHex(x));
	else rpcRequest.blobs = request.blobs;
	if (typeof request.data !== "undefined") rpcRequest.data = request.data;
	if (request.account) rpcRequest.from = request.account.address;
	if (typeof request.from !== "undefined") rpcRequest.from = request.from;
	if (typeof request.gas !== "undefined") rpcRequest.gas = numberToHex(request.gas);
	if (typeof request.gasPrice !== "undefined") rpcRequest.gasPrice = numberToHex(request.gasPrice);
	if (typeof request.maxFeePerBlobGas !== "undefined") rpcRequest.maxFeePerBlobGas = numberToHex(request.maxFeePerBlobGas);
	if (typeof request.maxFeePerGas !== "undefined") rpcRequest.maxFeePerGas = numberToHex(request.maxFeePerGas);
	if (typeof request.maxPriorityFeePerGas !== "undefined") rpcRequest.maxPriorityFeePerGas = numberToHex(request.maxPriorityFeePerGas);
	if (typeof request.nonce !== "undefined") rpcRequest.nonce = numberToHex(request.nonce);
	if (typeof request.to !== "undefined") rpcRequest.to = request.to;
	if (typeof request.type !== "undefined") rpcRequest.type = rpcTransactionType[request.type];
	if (typeof request.value !== "undefined") rpcRequest.value = numberToHex(request.value);
	return rpcRequest;
}
function formatAuthorizationList$1(authorizationList) {
	return authorizationList.map((authorization) => ({
		address: authorization.address,
		r: authorization.r ? numberToHex(BigInt(authorization.r)) : authorization.r,
		s: authorization.s ? numberToHex(BigInt(authorization.s)) : authorization.s,
		chainId: numberToHex(authorization.chainId),
		nonce: numberToHex(authorization.nonce),
		...typeof authorization.yParity !== "undefined" ? { yParity: numberToHex(authorization.yParity) } : {},
		...typeof authorization.v !== "undefined" && typeof authorization.yParity === "undefined" ? { v: numberToHex(authorization.v) } : {}
	}));
}
//#endregion
//#region node_modules/viem/_esm/utils/stateOverride.js
/** @internal */
function serializeStateMapping(stateMapping) {
	if (!stateMapping || stateMapping.length === 0) return void 0;
	return stateMapping.reduce((acc, { slot, value }) => {
		if (slot.length !== 66) throw new InvalidBytesLengthError({
			size: slot.length,
			targetSize: 66,
			type: "hex"
		});
		if (value.length !== 66) throw new InvalidBytesLengthError({
			size: value.length,
			targetSize: 66,
			type: "hex"
		});
		acc[slot] = value;
		return acc;
	}, {});
}
/** @internal */
function serializeAccountStateOverride(parameters) {
	const { balance, nonce, state, stateDiff, code } = parameters;
	const rpcAccountStateOverride = {};
	if (code !== void 0) rpcAccountStateOverride.code = code;
	if (balance !== void 0) rpcAccountStateOverride.balance = numberToHex(balance);
	if (nonce !== void 0) rpcAccountStateOverride.nonce = numberToHex(nonce);
	if (state !== void 0) rpcAccountStateOverride.state = serializeStateMapping(state);
	if (stateDiff !== void 0) {
		if (rpcAccountStateOverride.state) throw new StateAssignmentConflictError();
		rpcAccountStateOverride.stateDiff = serializeStateMapping(stateDiff);
	}
	return rpcAccountStateOverride;
}
/** @internal */
function serializeStateOverride(parameters) {
	if (!parameters) return void 0;
	const rpcStateOverride = {};
	for (const { address, ...accountState } of parameters) {
		if (!isAddress(address, { strict: false })) throw new InvalidAddressError({ address });
		if (rpcStateOverride[address]) throw new AccountStateConflictError({ address });
		rpcStateOverride[address] = serializeAccountStateOverride(accountState);
	}
	return rpcStateOverride;
}
2n ** (8n - 1n) - 1n;
2n ** (16n - 1n) - 1n;
2n ** (24n - 1n) - 1n;
2n ** (32n - 1n) - 1n;
2n ** (40n - 1n) - 1n;
2n ** (48n - 1n) - 1n;
2n ** (56n - 1n) - 1n;
2n ** (64n - 1n) - 1n;
2n ** (72n - 1n) - 1n;
2n ** (80n - 1n) - 1n;
2n ** (88n - 1n) - 1n;
2n ** (96n - 1n) - 1n;
2n ** (104n - 1n) - 1n;
2n ** (112n - 1n) - 1n;
2n ** (120n - 1n) - 1n;
2n ** (128n - 1n) - 1n;
2n ** (136n - 1n) - 1n;
2n ** (144n - 1n) - 1n;
2n ** (152n - 1n) - 1n;
2n ** (160n - 1n) - 1n;
2n ** (168n - 1n) - 1n;
2n ** (176n - 1n) - 1n;
2n ** (184n - 1n) - 1n;
2n ** (192n - 1n) - 1n;
2n ** (200n - 1n) - 1n;
2n ** (208n - 1n) - 1n;
2n ** (216n - 1n) - 1n;
2n ** (224n - 1n) - 1n;
2n ** (232n - 1n) - 1n;
2n ** (240n - 1n) - 1n;
2n ** (248n - 1n) - 1n;
2n ** (256n - 1n) - 1n;
-(2n ** (8n - 1n));
-(2n ** (16n - 1n));
-(2n ** (24n - 1n));
-(2n ** (32n - 1n));
-(2n ** (40n - 1n));
-(2n ** (48n - 1n));
-(2n ** (56n - 1n));
-(2n ** (64n - 1n));
-(2n ** (72n - 1n));
-(2n ** (80n - 1n));
-(2n ** (88n - 1n));
-(2n ** (96n - 1n));
-(2n ** (104n - 1n));
-(2n ** (112n - 1n));
-(2n ** (120n - 1n));
-(2n ** (128n - 1n));
-(2n ** (136n - 1n));
-(2n ** (144n - 1n));
-(2n ** (152n - 1n));
-(2n ** (160n - 1n));
-(2n ** (168n - 1n));
-(2n ** (176n - 1n));
-(2n ** (184n - 1n));
-(2n ** (192n - 1n));
-(2n ** (200n - 1n));
-(2n ** (208n - 1n));
-(2n ** (216n - 1n));
-(2n ** (224n - 1n));
-(2n ** (232n - 1n));
-(2n ** (240n - 1n));
-(2n ** (248n - 1n));
-(2n ** (256n - 1n));
var maxUint256 = 2n ** 256n - 1n;
//#endregion
//#region node_modules/viem/_esm/utils/transaction/assertRequest.js
function assertRequest(args) {
	const { account: account_, maxFeePerGas, maxPriorityFeePerGas, to } = args;
	const account = account_ ? parseAccount(account_) : void 0;
	if (account && !isAddress(account.address)) throw new InvalidAddressError({ address: account.address });
	if (to && !isAddress(to)) throw new InvalidAddressError({ address: to });
	if (maxFeePerGas && maxFeePerGas > maxUint256) throw new FeeCapTooHighError({ maxFeePerGas });
	if (maxPriorityFeePerGas && maxFeePerGas && maxPriorityFeePerGas > maxFeePerGas) throw new TipAboveFeeCapError({
		maxFeePerGas,
		maxPriorityFeePerGas
	});
}
//#endregion
//#region node_modules/viem/_esm/errors/fee.js
var BaseFeeScalarError = class extends BaseError {
	constructor() {
		super("`baseFeeMultiplier` must be greater than 1.", { name: "BaseFeeScalarError" });
	}
};
var Eip1559FeesNotSupportedError = class extends BaseError {
	constructor() {
		super("Chain does not support EIP-1559 fees.", { name: "Eip1559FeesNotSupportedError" });
	}
};
var MaxFeePerGasTooLowError = class extends BaseError {
	constructor({ maxPriorityFeePerGas }) {
		super(`\`maxFeePerGas\` cannot be less than the \`maxPriorityFeePerGas\` (${formatGwei(maxPriorityFeePerGas)} gwei).`, { name: "MaxFeePerGasTooLowError" });
	}
};
//#endregion
//#region node_modules/viem/_esm/errors/block.js
var BlockNotFoundError = class extends BaseError {
	constructor({ blockHash, blockNumber }) {
		let identifier = "Block";
		if (blockHash) identifier = `Block at hash "${blockHash}"`;
		if (blockNumber) identifier = `Block at number "${blockNumber}"`;
		super(`${identifier} could not be found.`, { name: "BlockNotFoundError" });
	}
};
//#endregion
//#region node_modules/viem/_esm/utils/formatters/transaction.js
var transactionType = {
	"0x0": "legacy",
	"0x1": "eip2930",
	"0x2": "eip1559",
	"0x3": "eip4844",
	"0x4": "eip7702"
};
function formatTransaction(transaction, _) {
	const transaction_ = {
		...transaction,
		blockHash: transaction.blockHash ? transaction.blockHash : null,
		blockNumber: transaction.blockNumber ? BigInt(transaction.blockNumber) : null,
		...transaction.blockTimestamp != null && { blockTimestamp: BigInt(transaction.blockTimestamp) },
		chainId: transaction.chainId ? hexToNumber(transaction.chainId) : void 0,
		gas: transaction.gas ? BigInt(transaction.gas) : void 0,
		gasPrice: transaction.gasPrice ? BigInt(transaction.gasPrice) : void 0,
		maxFeePerBlobGas: transaction.maxFeePerBlobGas ? BigInt(transaction.maxFeePerBlobGas) : void 0,
		maxFeePerGas: transaction.maxFeePerGas ? BigInt(transaction.maxFeePerGas) : void 0,
		maxPriorityFeePerGas: transaction.maxPriorityFeePerGas ? BigInt(transaction.maxPriorityFeePerGas) : void 0,
		nonce: transaction.nonce ? hexToNumber(transaction.nonce) : void 0,
		to: transaction.to ? transaction.to : null,
		transactionIndex: transaction.transactionIndex ? Number(transaction.transactionIndex) : null,
		type: transaction.type ? transactionType[transaction.type] : void 0,
		typeHex: transaction.type ? transaction.type : void 0,
		value: transaction.value ? BigInt(transaction.value) : void 0,
		v: transaction.v ? BigInt(transaction.v) : void 0
	};
	if (transaction.authorizationList) transaction_.authorizationList = formatAuthorizationList(transaction.authorizationList);
	transaction_.yParity = (() => {
		if (transaction.yParity) return Number(transaction.yParity);
		if (typeof transaction_.v === "bigint") {
			if (transaction_.v === 0n || transaction_.v === 27n) return 0;
			if (transaction_.v === 1n || transaction_.v === 28n) return 1;
			if (transaction_.v >= 35n) return transaction_.v % 2n === 0n ? 1 : 0;
		}
	})();
	if (transaction_.type === "legacy") {
		delete transaction_.accessList;
		delete transaction_.maxFeePerBlobGas;
		delete transaction_.maxFeePerGas;
		delete transaction_.maxPriorityFeePerGas;
		delete transaction_.yParity;
	}
	if (transaction_.type === "eip2930") {
		delete transaction_.maxFeePerBlobGas;
		delete transaction_.maxFeePerGas;
		delete transaction_.maxPriorityFeePerGas;
	}
	if (transaction_.type === "eip1559") delete transaction_.maxFeePerBlobGas;
	return transaction_;
}
function formatAuthorizationList(authorizationList) {
	return authorizationList.map((authorization) => ({
		address: authorization.address,
		chainId: Number(authorization.chainId),
		nonce: Number(authorization.nonce),
		r: authorization.r,
		s: authorization.s,
		yParity: Number(authorization.yParity)
	}));
}
//#endregion
//#region node_modules/viem/_esm/utils/formatters/block.js
function formatBlock(block, _) {
	const transactions = (block.transactions ?? []).map((transaction) => {
		if (typeof transaction === "string") return transaction;
		return formatTransaction(transaction);
	});
	return {
		...block,
		baseFeePerGas: block.baseFeePerGas ? BigInt(block.baseFeePerGas) : null,
		blobGasUsed: block.blobGasUsed ? BigInt(block.blobGasUsed) : void 0,
		difficulty: block.difficulty ? BigInt(block.difficulty) : void 0,
		excessBlobGas: block.excessBlobGas ? BigInt(block.excessBlobGas) : void 0,
		gasLimit: block.gasLimit ? BigInt(block.gasLimit) : void 0,
		gasUsed: block.gasUsed ? BigInt(block.gasUsed) : void 0,
		hash: block.hash ? block.hash : null,
		logsBloom: block.logsBloom ? block.logsBloom : null,
		nonce: block.nonce ? block.nonce : null,
		number: block.number ? BigInt(block.number) : null,
		size: block.size ? BigInt(block.size) : void 0,
		timestamp: block.timestamp ? BigInt(block.timestamp) : void 0,
		transactions,
		totalDifficulty: block.totalDifficulty ? BigInt(block.totalDifficulty) : null
	};
}
//#endregion
//#region node_modules/viem/_esm/actions/public/getBlock.js
/**
* Returns information about a block at a block number, hash, or tag.
*
* - Docs: https://viem.sh/docs/actions/public/getBlock
* - Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/blocks_fetching-blocks
* - JSON-RPC Methods:
*   - Calls [`eth_getBlockByNumber`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getblockbynumber) for `blockNumber` & `blockTag`.
*   - Calls [`eth_getBlockByHash`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getblockbyhash) for `blockHash`.
*
* @param client - Client to use
* @param parameters - {@link GetBlockParameters}
* @returns Information about the block. {@link GetBlockReturnType}
*
* @example
* import { createPublicClient, http } from 'viem'
* import { mainnet } from 'viem/chains'
* import { getBlock } from 'viem/public'
*
* const client = createPublicClient({
*   chain: mainnet,
*   transport: http(),
* })
* const block = await getBlock(client)
*/
async function getBlock(client, { blockHash, blockNumber, blockTag = client.experimental_blockTag ?? "latest", includeTransactions: includeTransactions_ } = {}) {
	const includeTransactions = includeTransactions_ ?? false;
	const blockNumberHex = blockNumber !== void 0 ? numberToHex(blockNumber) : void 0;
	let block = null;
	if (blockHash) block = await client.request({
		method: "eth_getBlockByHash",
		params: [blockHash, includeTransactions]
	}, { dedupe: true });
	else block = await client.request({
		method: "eth_getBlockByNumber",
		params: [blockNumberHex || blockTag, includeTransactions]
	}, { dedupe: Boolean(blockNumberHex) });
	if (!block) throw new BlockNotFoundError({
		blockHash,
		blockNumber
	});
	return (client.chain?.formatters?.block?.format || formatBlock)(block, "getBlock");
}
//#endregion
//#region node_modules/viem/_esm/actions/public/getGasPrice.js
/**
* Returns the current price of gas (in wei).
*
* - Docs: https://viem.sh/docs/actions/public/getGasPrice
* - JSON-RPC Methods: [`eth_gasPrice`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_gasprice)
*
* @param client - Client to use
* @returns The gas price (in wei). {@link GetGasPriceReturnType}
*
* @example
* import { createPublicClient, http } from 'viem'
* import { mainnet } from 'viem/chains'
* import { getGasPrice } from 'viem/public'
*
* const client = createPublicClient({
*   chain: mainnet,
*   transport: http(),
* })
* const gasPrice = await getGasPrice(client)
*/
async function getGasPrice(client) {
	const gasPrice = await client.request({ method: "eth_gasPrice" });
	return BigInt(gasPrice);
}
//#endregion
//#region node_modules/viem/_esm/actions/public/estimateMaxPriorityFeePerGas.js
async function internal_estimateMaxPriorityFeePerGas(client, args) {
	const { block: block_, chain = client.chain, request } = args || {};
	try {
		const maxPriorityFeePerGas = chain?.fees?.maxPriorityFeePerGas ?? chain?.fees?.defaultPriorityFee;
		if (typeof maxPriorityFeePerGas === "function") {
			const maxPriorityFeePerGas_ = await maxPriorityFeePerGas({
				block: block_ || await getAction(client, getBlock, "getBlock")({}),
				client,
				request
			});
			if (maxPriorityFeePerGas_ === null) throw new Error();
			return maxPriorityFeePerGas_;
		}
		if (typeof maxPriorityFeePerGas !== "undefined") return maxPriorityFeePerGas;
		return hexToBigInt(await client.request({ method: "eth_maxPriorityFeePerGas" }));
	} catch {
		const [block, gasPrice] = await Promise.all([block_ ? Promise.resolve(block_) : getAction(client, getBlock, "getBlock")({}), getAction(client, getGasPrice, "getGasPrice")({})]);
		if (typeof block.baseFeePerGas !== "bigint") throw new Eip1559FeesNotSupportedError();
		const maxPriorityFeePerGas = gasPrice - block.baseFeePerGas;
		if (maxPriorityFeePerGas < 0n) return 0n;
		return maxPriorityFeePerGas;
	}
}
//#endregion
//#region node_modules/viem/_esm/actions/public/estimateFeesPerGas.js
async function internal_estimateFeesPerGas(client, args) {
	const { block: block_, chain = client.chain, request, type = "eip1559" } = args || {};
	const baseFeeMultiplier = await (async () => {
		if (typeof chain?.fees?.baseFeeMultiplier === "function") return chain.fees.baseFeeMultiplier({
			block: block_,
			client,
			request
		});
		return chain?.fees?.baseFeeMultiplier ?? 1.2;
	})();
	if (baseFeeMultiplier < 1) throw new BaseFeeScalarError();
	const denominator = 10 ** (baseFeeMultiplier.toString().split(".")[1]?.length ?? 0);
	const multiply = (base) => base * BigInt(Math.ceil(baseFeeMultiplier * denominator)) / BigInt(denominator);
	const block = block_ ? block_ : await getAction(client, getBlock, "getBlock")({});
	if (typeof chain?.fees?.estimateFeesPerGas === "function") {
		const fees = await chain.fees.estimateFeesPerGas({
			block: block_,
			client,
			multiply,
			request,
			type
		});
		if (fees !== null) return fees;
	}
	if (type === "eip1559") {
		if (typeof block.baseFeePerGas !== "bigint") throw new Eip1559FeesNotSupportedError();
		const maxPriorityFeePerGas = typeof request?.maxPriorityFeePerGas === "bigint" ? request.maxPriorityFeePerGas : await internal_estimateMaxPriorityFeePerGas(client, {
			block,
			chain,
			request
		});
		const baseFeePerGas = multiply(block.baseFeePerGas);
		return {
			maxFeePerGas: request?.maxFeePerGas ?? baseFeePerGas + maxPriorityFeePerGas,
			maxPriorityFeePerGas
		};
	}
	return { gasPrice: request?.gasPrice ?? multiply(await getAction(client, getGasPrice, "getGasPrice")({})) };
}
//#endregion
//#region node_modules/viem/_esm/utils/block/formatBlockParameter.js
/**
* Formats block parameters for RPC calls according to EIP-1898.
*
* @param parameters - Block parameters
* @returns Formatted block parameter for RPC call
*
* @example
* // Using block tag
* formatBlockParameter({ blockTag: 'latest' })
* // => 'latest'
*
* @example
* // Using block number
* formatBlockParameter({ blockNumber: 69420n })
* // => '0x10f2c'
*
* @example
* // Using block hash (EIP-1898)
* formatBlockParameter({ blockHash: '0x...' })
* // => { blockHash: '0x...' }
*
* @example
* // Using block hash with requireCanonical (EIP-1898)
* formatBlockParameter({ blockHash: '0x...', requireCanonical: true })
* // => { blockHash: '0x...', requireCanonical: true }
*/
function formatBlockParameter(parameters) {
	const { blockHash, blockNumber, blockTag, requireCanonical } = parameters;
	if (requireCanonical !== void 0 && !blockHash) throw new BaseError("`requireCanonical` can only be provided when `blockHash` is set.");
	if (blockHash) return requireCanonical ? {
		blockHash,
		requireCanonical
	} : { blockHash };
	if (typeof blockNumber === "bigint") return numberToHex(blockNumber);
	return blockTag ?? "latest";
}
//#endregion
//#region node_modules/viem/_esm/actions/public/getTransactionCount.js
/**
* Returns the number of [Transactions](https://viem.sh/docs/glossary/terms#transaction) an Account has sent.
*
* - Docs: https://viem.sh/docs/actions/public/getTransactionCount
* - JSON-RPC Methods: [`eth_getTransactionCount`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_gettransactioncount)
*
* @param client - Client to use
* @param parameters - {@link GetTransactionCountParameters}
* @returns The number of transactions an account has sent. {@link GetTransactionCountReturnType}
*
* @example
* import { createPublicClient, http } from 'viem'
* import { mainnet } from 'viem/chains'
* import { getTransactionCount } from 'viem/public'
*
* const client = createPublicClient({
*   chain: mainnet,
*   transport: http(),
* })
* const transactionCount = await getTransactionCount(client, {
*   address: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
* })
*/
async function getTransactionCount(client, { address, blockHash, blockNumber, blockTag = "latest", requireCanonical }) {
	const block = formatBlockParameter({
		blockHash,
		blockNumber,
		blockTag,
		requireCanonical
	});
	return hexToNumber(await client.request({
		method: "eth_getTransactionCount",
		params: [address, block]
	}, { dedupe: typeof blockNumber === "bigint" || blockHash !== void 0 }));
}
//#endregion
//#region node_modules/viem/_esm/utils/blob/blobsToCommitments.js
/**
* Compute commitments from a list of blobs.
*
* @example
* ```ts
* import { blobsToCommitments, toBlobs } from 'viem'
* import { kzg } from './kzg'
*
* const blobs = toBlobs({ data: '0x1234' })
* const commitments = blobsToCommitments({ blobs, kzg })
* ```
*/
function blobsToCommitments(parameters) {
	const { kzg } = parameters;
	const to = parameters.to ?? (typeof parameters.blobs[0] === "string" ? "hex" : "bytes");
	const blobs = typeof parameters.blobs[0] === "string" ? parameters.blobs.map((x) => hexToBytes(x)) : parameters.blobs;
	const commitments = [];
	for (const blob of blobs) commitments.push(Uint8Array.from(kzg.blobToKzgCommitment(blob)));
	return to === "bytes" ? commitments : commitments.map((x) => bytesToHex(x));
}
//#endregion
//#region node_modules/viem/_esm/utils/blob/blobsToProofs.js
/**
* Compute the proofs for a list of blobs and their commitments.
*
* @example
* ```ts
* import {
*   blobsToCommitments,
*   toBlobs
* } from 'viem'
* import { kzg } from './kzg'
*
* const blobs = toBlobs({ data: '0x1234' })
* const commitments = blobsToCommitments({ blobs, kzg })
* const proofs = blobsToProofs({ blobs, commitments, kzg })
* ```
*/
function blobsToProofs(parameters) {
	const { kzg } = parameters;
	const to = parameters.to ?? (typeof parameters.blobs[0] === "string" ? "hex" : "bytes");
	const blobs = typeof parameters.blobs[0] === "string" ? parameters.blobs.map((x) => hexToBytes(x)) : parameters.blobs;
	const commitments = typeof parameters.commitments[0] === "string" ? parameters.commitments.map((x) => hexToBytes(x)) : parameters.commitments;
	const proofs = [];
	for (let i = 0; i < blobs.length; i++) {
		const blob = blobs[i];
		const commitment = commitments[i];
		proofs.push(Uint8Array.from(kzg.computeBlobKzgProof(blob, commitment)));
	}
	return to === "bytes" ? proofs : proofs.map((x) => bytesToHex(x));
}
//#endregion
//#region node_modules/viem/node_modules/@noble/hashes/esm/sha256.js
/**
* SHA2-256 a.k.a. sha256. In JS, it is the fastest hash, even faster than Blake3.
*
* To break sha256 using birthday attack, attackers need to try 2^128 hashes.
* BTC network is doing 2^70 hashes/sec (2^95 hashes/year) as per 2025.
*
* Check out [FIPS 180-4](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf).
* @module
* @deprecated
*/
/** @deprecated Use import from `noble/hashes/sha2` module */
var sha256$1 = sha256$2;
//#endregion
//#region node_modules/viem/_esm/utils/hash/sha256.js
function sha256(value, to_) {
	const to = to_ || "hex";
	const bytes = sha256$1(isHex(value, { strict: false }) ? toBytes(value) : value);
	if (to === "bytes") return bytes;
	return toHex(bytes);
}
//#endregion
//#region node_modules/viem/_esm/utils/blob/commitmentToVersionedHash.js
/**
* Transform a commitment to it's versioned hash.
*
* @example
* ```ts
* import {
*   blobsToCommitments,
*   commitmentToVersionedHash,
*   toBlobs
* } from 'viem'
* import { kzg } from './kzg'
*
* const blobs = toBlobs({ data: '0x1234' })
* const [commitment] = blobsToCommitments({ blobs, kzg })
* const versionedHash = commitmentToVersionedHash({ commitment })
* ```
*/
function commitmentToVersionedHash(parameters) {
	const { commitment, version = 1 } = parameters;
	const to = parameters.to ?? (typeof commitment === "string" ? "hex" : "bytes");
	const versionedHash = sha256(commitment, "bytes");
	versionedHash.set([version], 0);
	return to === "bytes" ? versionedHash : bytesToHex(versionedHash);
}
//#endregion
//#region node_modules/viem/_esm/utils/blob/commitmentsToVersionedHashes.js
/**
* Transform a list of commitments to their versioned hashes.
*
* @example
* ```ts
* import {
*   blobsToCommitments,
*   commitmentsToVersionedHashes,
*   toBlobs
* } from 'viem'
* import { kzg } from './kzg'
*
* const blobs = toBlobs({ data: '0x1234' })
* const commitments = blobsToCommitments({ blobs, kzg })
* const versionedHashes = commitmentsToVersionedHashes({ commitments })
* ```
*/
function commitmentsToVersionedHashes(parameters) {
	const { commitments, version } = parameters;
	const to = parameters.to ?? (typeof commitments[0] === "string" ? "hex" : "bytes");
	const hashes = [];
	for (const commitment of commitments) hashes.push(commitmentToVersionedHash({
		commitment,
		to,
		version
	}));
	return hashes;
}
//#endregion
//#region node_modules/viem/_esm/constants/blob.js
/** Blob limit per transaction. */
var blobsPerTransaction = 6;
/** The number of field elements in a blob. */
var fieldElementsPerBlob = 4096;
/** The number of bytes in a blob. */
var bytesPerBlob = 32 * fieldElementsPerBlob;
/** Blob bytes limit per transaction. */
var maxBytesPerTransaction = bytesPerBlob * blobsPerTransaction - 1 - 1 * fieldElementsPerBlob * blobsPerTransaction;
//#endregion
//#region node_modules/viem/_esm/errors/blob.js
var BlobSizeTooLargeError = class extends BaseError {
	constructor({ maxSize, size }) {
		super("Blob size is too large.", {
			metaMessages: [`Max: ${maxSize} bytes`, `Given: ${size} bytes`],
			name: "BlobSizeTooLargeError"
		});
	}
};
var EmptyBlobError = class extends BaseError {
	constructor() {
		super("Blob data must not be empty.", { name: "EmptyBlobError" });
	}
};
//#endregion
//#region node_modules/viem/_esm/utils/blob/toBlobs.js
/**
* Transforms arbitrary data to blobs.
*
* @example
* ```ts
* import { toBlobs, stringToHex } from 'viem'
*
* const blobs = toBlobs({ data: stringToHex('hello world') })
* ```
*/
function toBlobs(parameters) {
	const to = parameters.to ?? (typeof parameters.data === "string" ? "hex" : "bytes");
	const data = typeof parameters.data === "string" ? hexToBytes(parameters.data) : parameters.data;
	const size_ = size$1(data);
	if (!size_) throw new EmptyBlobError();
	if (size_ > 761855) throw new BlobSizeTooLargeError({
		maxSize: maxBytesPerTransaction,
		size: size_
	});
	const blobs = [];
	let active = true;
	let position = 0;
	while (active) {
		const blob = createCursor(new Uint8Array(bytesPerBlob));
		let size = 0;
		while (size < fieldElementsPerBlob) {
			const bytes = data.slice(position, position + 31);
			blob.pushByte(0);
			blob.pushBytes(bytes);
			if (bytes.length < 31) {
				blob.pushByte(128);
				active = false;
				break;
			}
			size++;
			position += 31;
		}
		blobs.push(blob);
	}
	return to === "bytes" ? blobs.map((x) => x.bytes) : blobs.map((x) => bytesToHex(x.bytes));
}
//#endregion
//#region node_modules/viem/_esm/utils/blob/toBlobSidecars.js
/**
* Transforms arbitrary data (or blobs, commitments, & proofs) into a sidecar array.
*
* @example
* ```ts
* import { toBlobSidecars, stringToHex } from 'viem'
*
* const sidecars = toBlobSidecars({ data: stringToHex('hello world') })
* ```
*
* @example
* ```ts
* import {
*   blobsToCommitments,
*   toBlobs,
*   blobsToProofs,
*   toBlobSidecars,
*   stringToHex
* } from 'viem'
*
* const blobs = toBlobs({ data: stringToHex('hello world') })
* const commitments = blobsToCommitments({ blobs, kzg })
* const proofs = blobsToProofs({ blobs, commitments, kzg })
*
* const sidecars = toBlobSidecars({ blobs, commitments, proofs })
* ```
*/
function toBlobSidecars(parameters) {
	const { data, kzg, to } = parameters;
	const blobs = parameters.blobs ?? toBlobs({
		data,
		to
	});
	const commitments = parameters.commitments ?? blobsToCommitments({
		blobs,
		kzg,
		to
	});
	const proofs = parameters.proofs ?? blobsToProofs({
		blobs,
		commitments,
		kzg,
		to
	});
	const sidecars = [];
	for (let i = 0; i < blobs.length; i++) sidecars.push({
		blob: blobs[i],
		commitment: commitments[i],
		proof: proofs[i]
	});
	return sidecars;
}
//#endregion
//#region node_modules/viem/_esm/utils/transaction/getTransactionType.js
function getTransactionType(transaction) {
	if (transaction.type) return transaction.type;
	if (typeof transaction.authorizationList !== "undefined") return "eip7702";
	if (typeof transaction.blobs !== "undefined" || typeof transaction.blobVersionedHashes !== "undefined" || typeof transaction.maxFeePerBlobGas !== "undefined" || typeof transaction.sidecars !== "undefined") return "eip4844";
	if (typeof transaction.maxFeePerGas !== "undefined" || typeof transaction.maxPriorityFeePerGas !== "undefined") return "eip1559";
	if (typeof transaction.gasPrice !== "undefined") {
		if (typeof transaction.accessList !== "undefined") return "eip2930";
		return "legacy";
	}
	throw new InvalidSerializableTransactionError({ transaction });
}
//#endregion
//#region node_modules/viem/_esm/utils/errors/getTransactionError.js
function getTransactionError(err, { docsPath, ...args }) {
	return new TransactionExecutionError((() => {
		const cause = getNodeError(err, args);
		if (cause instanceof UnknownNodeError) return err;
		return cause;
	})(), {
		docsPath,
		...args
	});
}
//#endregion
//#region node_modules/viem/_esm/actions/public/getChainId.js
/**
* Returns the chain ID associated with the current network.
*
* - Docs: https://viem.sh/docs/actions/public/getChainId
* - JSON-RPC Methods: [`eth_chainId`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_chainid)
*
* @param client - Client to use
* @returns The current chain ID. {@link GetChainIdReturnType}
*
* @example
* import { createPublicClient, http } from 'viem'
* import { mainnet } from 'viem/chains'
* import { getChainId } from 'viem/public'
*
* const client = createPublicClient({
*   chain: mainnet,
*   transport: http(),
* })
* const chainId = await getChainId(client)
* // 1
*/
async function getChainId(client) {
	return hexToNumber(await client.request({ method: "eth_chainId" }, { dedupe: true }));
}
//#endregion
//#region node_modules/viem/_esm/actions/public/fillTransaction.js
/**
* Fills a transaction request with the necessary fields to be signed over.
*
* - Docs: https://viem.sh/docs/actions/public/fillTransaction
*
* @param client - Client to use
* @param parameters - {@link FillTransactionParameters}
* @returns The filled transaction. {@link FillTransactionReturnType}
*
* @example
* import { createPublicClient, http } from 'viem'
* import { mainnet } from 'viem/chains'
* import { fillTransaction } from 'viem/public'
*
* const client = createPublicClient({
*   chain: mainnet,
*   transport: http(),
* })
* const result = await fillTransaction(client, {
*   account: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
*   to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
*   value: parseEther('1'),
* })
*/
async function fillTransaction(client, parameters) {
	const { account = client.account, accessList, authorizationList, chain = client.chain, blobVersionedHashes, blobs, data, gas, gasPrice, maxFeePerBlobGas, maxFeePerGas, maxPriorityFeePerGas, nonce: nonce_, nonceManager, to, type, value, ...rest } = parameters;
	const nonce = await (async () => {
		if (!account) return nonce_;
		if (!nonceManager) return nonce_;
		if (typeof nonce_ !== "undefined") return nonce_;
		const account_ = parseAccount(account);
		const chainId = chain ? chain.id : await getAction(client, getChainId, "getChainId")({});
		return await nonceManager.consume({
			address: account_.address,
			chainId,
			client
		});
	})();
	assertRequest(parameters);
	const chainFormat = chain?.formatters?.transactionRequest?.format;
	const request = (chainFormat || formatTransactionRequest)({
		...extract(rest, { format: chainFormat }),
		account: account ? parseAccount(account) : void 0,
		accessList,
		authorizationList,
		blobs,
		blobVersionedHashes,
		data,
		gas,
		gasPrice,
		maxFeePerBlobGas,
		maxFeePerGas,
		maxPriorityFeePerGas,
		nonce,
		to,
		type,
		value
	}, "fillTransaction");
	try {
		const response = await client.request({
			method: "eth_fillTransaction",
			params: [request]
		});
		const transaction = (chain?.formatters?.transaction?.format || formatTransaction)(response.tx);
		delete transaction.blockHash;
		delete transaction.blockNumber;
		delete transaction.r;
		delete transaction.s;
		delete transaction.transactionIndex;
		delete transaction.v;
		delete transaction.yParity;
		transaction.data = transaction.input;
		if (transaction.gas) transaction.gas = parameters.gas ?? transaction.gas;
		if (transaction.gasPrice) transaction.gasPrice = parameters.gasPrice ?? transaction.gasPrice;
		if (transaction.maxFeePerBlobGas) transaction.maxFeePerBlobGas = parameters.maxFeePerBlobGas ?? transaction.maxFeePerBlobGas;
		if (transaction.maxFeePerGas) transaction.maxFeePerGas = parameters.maxFeePerGas ?? transaction.maxFeePerGas;
		if (transaction.maxPriorityFeePerGas) transaction.maxPriorityFeePerGas = parameters.maxPriorityFeePerGas ?? transaction.maxPriorityFeePerGas;
		if (typeof transaction.nonce !== "undefined") transaction.nonce = parameters.nonce ?? transaction.nonce;
		const feeMultiplier = await (async () => {
			if (typeof chain?.fees?.baseFeeMultiplier === "function") {
				const block = await getAction(client, getBlock, "getBlock")({});
				return chain.fees.baseFeeMultiplier({
					block,
					client,
					request: parameters
				});
			}
			return chain?.fees?.baseFeeMultiplier ?? 1.2;
		})();
		if (feeMultiplier < 1) throw new BaseFeeScalarError();
		const denominator = 10 ** (feeMultiplier.toString().split(".")[1]?.length ?? 0);
		const multiplyFee = (base) => base * BigInt(Math.ceil(feeMultiplier * denominator)) / BigInt(denominator);
		if (!transaction.feePayerSignature) {
			if (transaction.maxFeePerGas && !parameters.maxFeePerGas) transaction.maxFeePerGas = multiplyFee(transaction.maxFeePerGas);
			if (transaction.gasPrice && !parameters.gasPrice) transaction.gasPrice = multiplyFee(transaction.gasPrice);
		}
		return {
			raw: response.raw,
			transaction: {
				from: request.from,
				...transaction
			},
			...response.capabilities ? { capabilities: response.capabilities } : {}
		};
	} catch (err) {
		throw getTransactionError(err, {
			...parameters,
			chain: client.chain
		});
	}
}
//#endregion
//#region node_modules/viem/_esm/actions/wallet/prepareTransactionRequest.js
var defaultParameters = [
	"blobVersionedHashes",
	"chainId",
	"fees",
	"gas",
	"nonce",
	"type"
];
/** @internal */
var eip1559NetworkCache = /* @__PURE__ */ new Map();
/** @internal */
var supportsFillTransaction = /* @__PURE__ */ new LruMap(128);
/**
* Prepares a transaction request for signing.
*
* - Docs: https://viem.sh/docs/actions/wallet/prepareTransactionRequest
*
* @param args - {@link PrepareTransactionRequestParameters}
* @returns The transaction request. {@link PrepareTransactionRequestReturnType}
*
* @example
* import { createWalletClient, custom } from 'viem'
* import { mainnet } from 'viem/chains'
* import { prepareTransactionRequest } from 'viem/actions'
*
* const client = createWalletClient({
*   chain: mainnet,
*   transport: custom(window.ethereum),
* })
* const request = await prepareTransactionRequest(client, {
*   account: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
*   to: '0x0000000000000000000000000000000000000000',
*   value: 1n,
* })
*
* @example
* // Account Hoisting
* import { createWalletClient, http } from 'viem'
* import { privateKeyToAccount } from 'viem/accounts'
* import { mainnet } from 'viem/chains'
* import { prepareTransactionRequest } from 'viem/actions'
*
* const client = createWalletClient({
*   account: privateKeyToAccount('0x…'),
*   chain: mainnet,
*   transport: custom(window.ethereum),
* })
* const request = await prepareTransactionRequest(client, {
*   to: '0x0000000000000000000000000000000000000000',
*   value: 1n,
* })
*/
async function prepareTransactionRequest(client, args) {
	let request = args;
	request.account ??= client.account;
	request.parameters ??= defaultParameters;
	const { account: account_, chain = client.chain, nonceManager, parameters } = request;
	const prepareTransactionRequest = (() => {
		if (typeof chain?.prepareTransactionRequest === "function") return {
			fn: chain.prepareTransactionRequest,
			runAt: ["beforeFillTransaction"]
		};
		if (Array.isArray(chain?.prepareTransactionRequest)) return {
			fn: chain.prepareTransactionRequest[0],
			runAt: chain.prepareTransactionRequest[1].runAt
		};
	})();
	let chainId;
	async function getChainId$1() {
		if (chainId) return chainId;
		if (typeof request.chainId !== "undefined") return request.chainId;
		if (chain) return chain.id;
		chainId = await getAction(client, getChainId, "getChainId")({});
		return chainId;
	}
	const account = account_ ? parseAccount(account_) : account_;
	let nonce = request.nonce;
	if (parameters.includes("nonce") && typeof nonce === "undefined" && account && nonceManager) {
		const chainId = await getChainId$1();
		nonce = await nonceManager.consume({
			address: account.address,
			chainId,
			client
		});
	}
	if (prepareTransactionRequest?.fn && prepareTransactionRequest.runAt?.includes("beforeFillTransaction")) {
		request = await prepareTransactionRequest.fn({
			...request,
			chain
		}, {
			client,
			phase: "beforeFillTransaction"
		});
		nonce ??= request.nonce;
	}
	const fillResult = (() => {
		if ((parameters.includes("blobVersionedHashes") || parameters.includes("sidecars")) && request.kzg && request.blobs) return false;
		if (supportsFillTransaction.get(client.uid) === false) return false;
		if (!["fees", "gas"].some((parameter) => parameters.includes(parameter))) return false;
		if (parameters.includes("chainId") && typeof request.chainId !== "number") return true;
		if (parameters.includes("nonce") && typeof nonce !== "number") return true;
		if (parameters.includes("fees") && typeof request.gasPrice !== "bigint" && (typeof request.maxFeePerGas !== "bigint" || typeof request.maxPriorityFeePerGas !== "bigint")) return true;
		if (parameters.includes("gas") && typeof request.gas !== "bigint") return true;
		return false;
	})() ? await getAction(client, fillTransaction, "fillTransaction")({
		...request,
		nonce
	}).then((result) => {
		const { chainId, from, gas, gasPrice, nonce, maxFeePerBlobGas, maxFeePerGas, maxPriorityFeePerGas, type, ...rest } = result.transaction;
		supportsFillTransaction.set(client.uid, true);
		return {
			...request,
			...from ? { from } : {},
			...type && !request.type ? { type } : {},
			...typeof chainId !== "undefined" ? { chainId } : {},
			...typeof gas !== "undefined" ? { gas } : {},
			...typeof gasPrice !== "undefined" ? { gasPrice } : {},
			...typeof nonce !== "undefined" ? { nonce } : {},
			...typeof maxFeePerBlobGas !== "undefined" && request.type !== "legacy" && request.type !== "eip2930" ? { maxFeePerBlobGas } : {},
			...typeof maxFeePerGas !== "undefined" && request.type !== "legacy" && request.type !== "eip2930" ? { maxFeePerGas } : {},
			...typeof maxPriorityFeePerGas !== "undefined" && request.type !== "legacy" && request.type !== "eip2930" ? { maxPriorityFeePerGas } : {},
			..."nonceKey" in rest && typeof rest.nonceKey !== "undefined" ? { nonceKey: rest.nonceKey } : {},
			..."keyAuthorization" in rest && typeof rest.keyAuthorization !== "undefined" && rest.keyAuthorization !== null && !("keyAuthorization" in request) ? { keyAuthorization: rest.keyAuthorization } : {},
			..."feePayerSignature" in rest && typeof rest.feePayerSignature !== "undefined" && rest.feePayerSignature !== null ? { feePayerSignature: rest.feePayerSignature } : {},
			..."feeToken" in rest && typeof rest.feeToken !== "undefined" && rest.feeToken !== null && !("feeToken" in request) ? { feeToken: rest.feeToken } : {},
			...result.capabilities ? { _capabilities: result.capabilities } : {}
		};
	}).catch((e) => {
		const error = e;
		if (error.name !== "TransactionExecutionError") return request;
		if (error.walk?.((e) => {
			return e.name === "ExecutionRevertedError";
		})) throw e;
		if (error.walk?.((e) => {
			const error = e;
			return error.name === "MethodNotFoundRpcError" || error.name === "MethodNotSupportedRpcError" || error.message?.includes("eth_fillTransaction is not available");
		})) supportsFillTransaction.set(client.uid, false);
		return request;
	}) : request;
	nonce ??= fillResult.nonce;
	request = {
		...fillResult,
		...account ? { from: account?.address } : {},
		...typeof nonce !== "undefined" ? { nonce } : {}
	};
	const { blobs, gas, kzg, type } = request;
	if (prepareTransactionRequest?.fn && prepareTransactionRequest.runAt?.includes("beforeFillParameters")) request = await prepareTransactionRequest.fn({
		...request,
		chain
	}, {
		client,
		phase: "beforeFillParameters"
	});
	let block;
	async function getBlock$1() {
		if (block) return block;
		block = await getAction(client, getBlock, "getBlock")({ blockTag: "latest" });
		return block;
	}
	if (parameters.includes("nonce") && typeof nonce === "undefined" && account && !nonceManager) request.nonce = await getAction(client, getTransactionCount, "getTransactionCount")({
		address: account.address,
		blockTag: "pending"
	});
	if ((parameters.includes("blobVersionedHashes") || parameters.includes("sidecars")) && blobs && kzg) {
		const commitments = blobsToCommitments({
			blobs,
			kzg
		});
		if (parameters.includes("blobVersionedHashes")) {
			const versionedHashes = commitmentsToVersionedHashes({
				commitments,
				to: "hex"
			});
			request.blobVersionedHashes = versionedHashes;
		}
		if (parameters.includes("sidecars")) {
			const sidecars = toBlobSidecars({
				blobs,
				commitments,
				proofs: blobsToProofs({
					blobs,
					commitments,
					kzg
				}),
				to: "hex"
			});
			request.sidecars = sidecars;
		}
	}
	if (parameters.includes("chainId")) request.chainId = await getChainId$1();
	if ((parameters.includes("fees") || parameters.includes("type")) && typeof type === "undefined") try {
		request.type = getTransactionType(request);
	} catch {
		let isEip1559Network = eip1559NetworkCache.get(client.uid);
		if (typeof isEip1559Network === "undefined") {
			isEip1559Network = typeof (await getBlock$1())?.baseFeePerGas === "bigint";
			eip1559NetworkCache.set(client.uid, isEip1559Network);
		}
		request.type = isEip1559Network ? "eip1559" : "legacy";
	}
	if (parameters.includes("fees")) if (request.type !== "legacy" && request.type !== "eip2930") {
		if (typeof request.maxFeePerGas === "undefined" || typeof request.maxPriorityFeePerGas === "undefined") {
			const { maxFeePerGas, maxPriorityFeePerGas } = await internal_estimateFeesPerGas(client, {
				block: await getBlock$1(),
				chain,
				request
			});
			if (typeof request.maxPriorityFeePerGas === "undefined" && request.maxFeePerGas && request.maxFeePerGas < maxPriorityFeePerGas) throw new MaxFeePerGasTooLowError({ maxPriorityFeePerGas });
			request.maxPriorityFeePerGas = maxPriorityFeePerGas;
			request.maxFeePerGas = maxFeePerGas;
		}
	} else {
		if (typeof request.maxFeePerGas !== "undefined" || typeof request.maxPriorityFeePerGas !== "undefined") throw new Eip1559FeesNotSupportedError();
		if (typeof request.gasPrice === "undefined") {
			const { gasPrice: gasPrice_ } = await internal_estimateFeesPerGas(client, {
				block: await getBlock$1(),
				chain,
				request,
				type: "legacy"
			});
			request.gasPrice = gasPrice_;
		}
	}
	if (parameters.includes("gas") && typeof gas === "undefined") request.gas = await getAction(client, estimateGas, "estimateGas")({
		...request,
		account,
		prepare: account?.type === "local" ? [] : ["blobVersionedHashes"]
	});
	if (prepareTransactionRequest?.fn && prepareTransactionRequest.runAt?.includes("afterFillParameters")) request = await prepareTransactionRequest.fn({
		...request,
		chain
	}, {
		client,
		phase: "afterFillParameters"
	});
	assertRequest(request);
	delete request.parameters;
	return request;
}
//#endregion
//#region node_modules/viem/_esm/actions/public/estimateGas.js
/**
* Estimates the gas necessary to complete a transaction without submitting it to the network.
*
* - Docs: https://viem.sh/docs/actions/public/estimateGas
* - JSON-RPC Methods: [`eth_estimateGas`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_estimategas)
*
* @param client - Client to use
* @param parameters - {@link EstimateGasParameters}
* @returns The gas estimate (in gas units). {@link EstimateGasReturnType}
*
* @example
* import { createPublicClient, http, parseEther } from 'viem'
* import { mainnet } from 'viem/chains'
* import { estimateGas } from 'viem/public'
*
* const client = createPublicClient({
*   chain: mainnet,
*   transport: http(),
* })
* const gasEstimate = await estimateGas(client, {
*   account: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
*   to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
*   value: parseEther('1'),
* })
*/
async function estimateGas(client, args) {
	const { account: account_ = client.account, prepare = true } = args;
	const account = account_ ? parseAccount(account_) : void 0;
	const parameters = (() => {
		if (Array.isArray(prepare)) return prepare;
		if (account?.type !== "local") return ["blobVersionedHashes"];
	})();
	try {
		const to = await (async () => {
			if (args.to) return args.to;
			if (args.authorizationList && args.authorizationList.length > 0) return await recoverAuthorizationAddress({ authorization: args.authorizationList[0] }).catch(() => {
				throw new BaseError("`to` is required. Could not infer from `authorizationList`");
			});
		})();
		const { accessList, authorizationList, blobs, blobVersionedHashes, blockNumber, blockTag, data, gas, gasPrice, maxFeePerBlobGas, maxFeePerGas, maxPriorityFeePerGas, nonce, value, stateOverride, ...rest } = prepare ? await prepareTransactionRequest(client, {
			...args,
			parameters,
			to
		}) : args;
		if (gas && args.gas !== gas) return gas;
		const block = (typeof blockNumber === "bigint" ? numberToHex(blockNumber) : void 0) || blockTag;
		const rpcStateOverride = serializeStateOverride(stateOverride);
		assertRequest(args);
		const chainFormat = client.chain?.formatters?.transactionRequest?.format;
		const request = (chainFormat || formatTransactionRequest)({
			...extract(rest, { format: chainFormat }),
			account,
			accessList,
			authorizationList,
			blobs,
			blobVersionedHashes,
			data,
			gasPrice,
			maxFeePerBlobGas,
			maxFeePerGas,
			maxPriorityFeePerGas,
			nonce,
			to,
			value
		}, "estimateGas");
		return BigInt(await client.request({
			method: "eth_estimateGas",
			params: rpcStateOverride ? [
				request,
				block ?? client.experimental_blockTag ?? "latest",
				rpcStateOverride
			] : block ? [request, block] : [request]
		}));
	} catch (err) {
		throw getEstimateGasError(err, {
			...args,
			account,
			chain: client.chain
		});
	}
}
//#endregion
//#region node_modules/viem/_esm/utils/formatters/log.js
function formatLog(log, { args, eventName } = {}) {
	return {
		...log,
		blockHash: log.blockHash ? log.blockHash : null,
		blockNumber: log.blockNumber ? BigInt(log.blockNumber) : null,
		blockTimestamp: log.blockTimestamp ? BigInt(log.blockTimestamp) : log.blockTimestamp === null ? null : void 0,
		logIndex: log.logIndex ? Number(log.logIndex) : null,
		transactionHash: log.transactionHash ? log.transactionHash : null,
		transactionIndex: log.transactionIndex ? Number(log.transactionIndex) : null,
		...eventName ? {
			args,
			eventName
		} : {}
	};
}
//#endregion
//#region node_modules/viem/_esm/errors/chain.js
var ChainMismatchError = class extends BaseError {
	constructor({ chain, currentChainId }) {
		super(`The current chain of the wallet (id: ${currentChainId}) does not match the target chain for the transaction (id: ${chain.id} – ${chain.name}).`, {
			metaMessages: [`Current Chain ID:  ${currentChainId}`, `Expected Chain ID: ${chain.id} – ${chain.name}`],
			name: "ChainMismatchError"
		});
	}
};
var ChainNotFoundError = class extends BaseError {
	constructor() {
		super(["No chain was provided to the request.", "Please provide a chain with the `chain` argument on the Action, or by supplying a `chain` to WalletClient."].join("\n"), { name: "ChainNotFoundError" });
	}
};
//#endregion
//#region node_modules/viem/_esm/utils/promise/withResolvers.js
/** @internal */
function withResolvers() {
	let resolve = () => void 0;
	let reject = () => void 0;
	return {
		promise: new Promise((resolve_, reject_) => {
			resolve = resolve_;
			reject = reject_;
		}),
		resolve,
		reject
	};
}
//#endregion
//#region node_modules/viem/_esm/utils/promise/createBatchScheduler.js
var schedulerCache = /* @__PURE__ */ new Map();
/** @internal */
function createBatchScheduler({ fn, id, shouldSplitBatch, wait = 0, sort }) {
	const exec = async () => {
		const scheduler = getScheduler();
		flush();
		const args = scheduler.map(({ args }) => args);
		if (args.length === 0) return;
		fn(args).then((data) => {
			if (sort && Array.isArray(data)) data.sort(sort);
			for (let i = 0; i < scheduler.length; i++) {
				const { resolve } = scheduler[i];
				resolve?.([data[i], data]);
			}
		}).catch((err) => {
			for (let i = 0; i < scheduler.length; i++) {
				const { reject } = scheduler[i];
				reject?.(err);
			}
		});
	};
	const flush = () => schedulerCache.delete(id);
	const getBatchedArgs = () => getScheduler().map(({ args }) => args);
	const getScheduler = () => schedulerCache.get(id) || [];
	const setScheduler = (item) => schedulerCache.set(id, [...getScheduler(), item]);
	return {
		flush,
		async schedule(args) {
			const { promise, resolve, reject } = withResolvers();
			if (shouldSplitBatch?.([...getBatchedArgs(), args])) exec();
			if (getScheduler().length > 0) {
				setScheduler({
					args,
					resolve,
					reject
				});
				return promise;
			}
			setScheduler({
				args,
				resolve,
				reject
			});
			setTimeout(exec, wait);
			return promise;
		}
	};
}
//#endregion
//#region node_modules/viem/_esm/utils/observe.js
/** @internal */
var listenersCache = /* @__PURE__ */ new Map();
/** @internal */
var cleanupCache = /* @__PURE__ */ new Map();
var callbackCount = 0;
/**
* @description Sets up an observer for a given function. If another function
* is set up under the same observer id, the function will only be called once
* for both instances of the observer.
*/
function observe(observerId, callbacks, fn) {
	const callbackId = ++callbackCount;
	const getListeners = () => listenersCache.get(observerId) || [];
	const unsubscribe = () => {
		const nextListeners = getListeners().filter((cb) => cb.id !== callbackId);
		if (nextListeners.length === 0) {
			listenersCache.delete(observerId);
			cleanupCache.delete(observerId);
			return;
		}
		listenersCache.set(observerId, nextListeners);
	};
	const unwatch = () => {
		const listeners = getListeners();
		if (!listeners.some((cb) => cb.id === callbackId)) return;
		const cleanup = cleanupCache.get(observerId);
		if (listeners.length === 1 && cleanup) {
			const p = cleanup();
			if (p instanceof Promise) p.catch(() => {});
		}
		unsubscribe();
	};
	const listeners = getListeners();
	listenersCache.set(observerId, [...listeners, {
		id: callbackId,
		fns: callbacks
	}]);
	if (listeners && listeners.length > 0) return unwatch;
	const emit = {};
	for (const key in callbacks) emit[key] = ((...args) => {
		const listeners = getListeners();
		if (listeners.length === 0) return;
		for (const listener of listeners) listener.fns[key]?.(...args);
	});
	const cleanup = fn(emit);
	if (typeof cleanup === "function") cleanupCache.set(observerId, cleanup);
	return unwatch;
}
//#endregion
//#region node_modules/viem/_esm/utils/wait.js
async function wait(time, { signal } = {}) {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(getAbortError(signal));
			return;
		}
		const cleanup = () => signal?.removeEventListener("abort", onAbort);
		const timeout = setTimeout(() => {
			cleanup();
			resolve();
		}, time);
		const onAbort = () => {
			clearTimeout(timeout);
			cleanup();
			reject(getAbortError(signal));
		};
		signal?.addEventListener("abort", onAbort, { once: true });
	});
}
//#endregion
//#region node_modules/viem/_esm/utils/poll.js
/**
* @description Polls a function at a specified interval.
*/
function poll(fn, { emitOnBegin, initialWaitTime, interval }) {
	let active = true;
	const unwatch = () => active = false;
	const watch = async () => {
		let data;
		if (emitOnBegin) data = await fn({ unpoll: unwatch });
		await wait(await initialWaitTime?.(data) ?? interval);
		const poll = async () => {
			if (!active) return;
			await fn({ unpoll: unwatch });
			await wait(interval);
			poll();
		};
		poll();
	};
	watch();
	return unwatch;
}
//#endregion
//#region node_modules/viem/_esm/utils/promise/withCache.js
/** @internal */
var promiseCache$1 = /* @__PURE__ */ new Map();
/** @internal */
var responseCache = /* @__PURE__ */ new Map();
function getCache(cacheKey) {
	const buildCache = (cacheKey, cache) => ({
		clear: () => cache.delete(cacheKey),
		get: () => cache.get(cacheKey),
		set: (data) => cache.set(cacheKey, data)
	});
	const promise = buildCache(cacheKey, promiseCache$1);
	const response = buildCache(cacheKey, responseCache);
	return {
		clear: () => {
			promise.clear();
			response.clear();
		},
		promise,
		response
	};
}
/**
* @description Returns the result of a given promise, and caches the result for
* subsequent invocations against a provided cache key.
*/
async function withCache(fn, { cacheKey, cacheTime = Number.POSITIVE_INFINITY }) {
	const cache = getCache(cacheKey);
	const response = cache.response.get();
	if (response && cacheTime > 0) {
		if (Date.now() - response.created.getTime() < cacheTime) return response.data;
	}
	let promise = cache.promise.get();
	if (!promise) {
		promise = fn();
		cache.promise.set(promise);
	}
	try {
		const data = await promise;
		cache.response.set({
			created: /* @__PURE__ */ new Date(),
			data
		});
		return data;
	} finally {
		cache.promise.clear();
	}
}
//#endregion
//#region node_modules/viem/_esm/actions/public/getBlockNumber.js
var cacheKey = (id) => `blockNumber.${id}`;
/**
* Returns the number of the most recent block seen.
*
* - Docs: https://viem.sh/docs/actions/public/getBlockNumber
* - Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/blocks_fetching-blocks
* - JSON-RPC Methods: [`eth_blockNumber`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_blocknumber)
*
* @param client - Client to use
* @param parameters - {@link GetBlockNumberParameters}
* @returns The number of the block. {@link GetBlockNumberReturnType}
*
* @example
* import { createPublicClient, http } from 'viem'
* import { mainnet } from 'viem/chains'
* import { getBlockNumber } from 'viem/public'
*
* const client = createPublicClient({
*   chain: mainnet,
*   transport: http(),
* })
* const blockNumber = await getBlockNumber(client)
* // 69420n
*/
async function getBlockNumber(client, { cacheTime = client.cacheTime } = {}) {
	const blockNumberHex = await withCache(() => client.request({ method: "eth_blockNumber" }), {
		cacheKey: cacheKey(client.uid),
		cacheTime
	});
	return BigInt(blockNumberHex);
}
//#endregion
//#region node_modules/viem/_esm/errors/account.js
var AccountNotFoundError = class extends BaseError {
	constructor({ docsPath } = {}) {
		super(["Could not find an Account to execute with this Action.", "Please provide an Account with the `account` argument on the Action, or by supplying an `account` to the Client."].join("\n"), {
			docsPath,
			docsSlug: "account",
			name: "AccountNotFoundError"
		});
	}
};
var AccountTypeNotSupportedError = class extends BaseError {
	constructor({ docsPath, metaMessages, type }) {
		super(`Account type "${type}" is not supported.`, {
			docsPath,
			metaMessages,
			name: "AccountTypeNotSupportedError"
		});
	}
};
//#endregion
//#region node_modules/viem/_esm/utils/chain/assertCurrentChain.js
function assertCurrentChain({ chain, currentChainId }) {
	if (!chain) throw new ChainNotFoundError();
	if (currentChainId !== chain.id) throw new ChainMismatchError({
		chain,
		currentChainId
	});
}
//#endregion
//#region node_modules/viem/_esm/actions/wallet/sendRawTransaction.js
/**
* Sends a **signed** transaction to the network
*
* - Docs: https://viem.sh/docs/actions/wallet/sendRawTransaction
* - JSON-RPC Method: [`eth_sendRawTransaction`](https://ethereum.github.io/execution-apis/api-documentation/)
*
* @param client - Client to use
* @param parameters - {@link SendRawTransactionParameters}
* @returns The transaction hash. {@link SendRawTransactionReturnType}
*
* @example
* import { createWalletClient, custom } from 'viem'
* import { mainnet } from 'viem/chains'
* import { sendRawTransaction } from 'viem/wallet'
*
* const client = createWalletClient({
*   chain: mainnet,
*   transport: custom(window.ethereum),
* })
*
* const hash = await sendRawTransaction(client, {
*   serializedTransaction: '0x02f850018203118080825208808080c080a04012522854168b27e5dc3d5839bab5e6b39e1a0ffd343901ce1622e3d64b48f1a04e00902ae0502c4728cbf12156290df99c3ed7de85b1dbfe20b5c36931733a33'
* })
*/
async function sendRawTransaction(client, { serializedTransaction }) {
	return client.request({
		method: "eth_sendRawTransaction",
		params: [serializedTransaction]
	}, { retryCount: 0 });
}
//#endregion
//#region node_modules/viem/_esm/actions/wallet/sendTransaction.js
var supportsWalletNamespace = new LruMap(128);
/**
* Creates, signs, and sends a new transaction to the network.
*
* - Docs: https://viem.sh/docs/actions/wallet/sendTransaction
* - Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/transactions_sending-transactions
* - JSON-RPC Methods:
*   - JSON-RPC Accounts: [`eth_sendTransaction`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_sendtransaction)
*   - Local Accounts: [`eth_sendRawTransaction`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_sendrawtransaction)
*
* @param client - Client to use
* @param parameters - {@link SendTransactionParameters}
* @returns The [Transaction](https://viem.sh/docs/glossary/terms#transaction) hash. {@link SendTransactionReturnType}
*
* @example
* import { createWalletClient, custom } from 'viem'
* import { mainnet } from 'viem/chains'
* import { sendTransaction } from 'viem/wallet'
*
* const client = createWalletClient({
*   chain: mainnet,
*   transport: custom(window.ethereum),
* })
* const hash = await sendTransaction(client, {
*   account: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
*   to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
*   value: 1000000000000000000n,
* })
*
* @example
* // Account Hoisting
* import { createWalletClient, http } from 'viem'
* import { privateKeyToAccount } from 'viem/accounts'
* import { mainnet } from 'viem/chains'
* import { sendTransaction } from 'viem/wallet'
*
* const client = createWalletClient({
*   account: privateKeyToAccount('0x…'),
*   chain: mainnet,
*   transport: http(),
* })
* const hash = await sendTransaction(client, {
*   to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
*   value: 1000000000000000000n,
* })
*/
async function sendTransaction(client, parameters) {
	const { account: account_ = client.account, assertChainId = true, chain = client.chain, accessList, authorizationList, blobs, data, dataSuffix = typeof client.dataSuffix === "string" ? client.dataSuffix : client.dataSuffix?.value, gas, gasPrice, maxFeePerBlobGas, maxFeePerGas, maxPriorityFeePerGas, nonce, type, value, ...rest } = parameters;
	if (typeof account_ === "undefined") throw new AccountNotFoundError({ docsPath: "/docs/actions/wallet/sendTransaction" });
	const account = account_ ? parseAccount(account_) : null;
	let nonceManagerParameters;
	try {
		assertRequest(parameters);
		const to = await (async () => {
			if (parameters.to) return parameters.to;
			if (parameters.to === null) return void 0;
			if (authorizationList && authorizationList.length > 0) return await recoverAuthorizationAddress({ authorization: authorizationList[0] }).catch(() => {
				throw new BaseError("`to` is required. Could not infer from `authorizationList`.");
			});
		})();
		if (account?.type === "json-rpc" || account === null) {
			let chainId;
			if (chain !== null) {
				chainId = await getAction(client, getChainId, "getChainId")({});
				if (assertChainId) assertCurrentChain({
					currentChainId: chainId,
					chain
				});
			}
			const chainFormat = client.chain?.formatters?.transactionRequest?.format;
			const request = (chainFormat || formatTransactionRequest)({
				...extract(rest, { format: chainFormat }),
				accessList,
				account,
				authorizationList,
				blobs,
				chainId,
				data: dataSuffix ? concat([data ?? "0x", dataSuffix]) : data,
				gas,
				gasPrice,
				maxFeePerBlobGas,
				maxFeePerGas,
				maxPriorityFeePerGas,
				nonce,
				to,
				type,
				value
			}, "sendTransaction");
			const isWalletNamespaceSupported = supportsWalletNamespace.get(client.uid);
			const method = isWalletNamespaceSupported ? "wallet_sendTransaction" : "eth_sendTransaction";
			try {
				return await client.request({
					method,
					params: [request]
				}, { retryCount: 0 });
			} catch (e) {
				if (isWalletNamespaceSupported === false) throw e;
				const error = e;
				if (error.name === "InvalidInputRpcError" || error.name === "InvalidParamsRpcError" || error.name === "MethodNotFoundRpcError" || error.name === "MethodNotSupportedRpcError") return await client.request({
					method: "wallet_sendTransaction",
					params: [request]
				}, { retryCount: 0 }).then((hash) => {
					supportsWalletNamespace.set(client.uid, true);
					return hash;
				}).catch((e) => {
					const walletNamespaceError = e;
					if (walletNamespaceError.name === "MethodNotFoundRpcError" || walletNamespaceError.name === "MethodNotSupportedRpcError") {
						supportsWalletNamespace.set(client.uid, false);
						throw error;
					}
					throw walletNamespaceError;
				});
				throw error;
			}
		}
		if (account?.type === "local") {
			if (account.nonceManager && typeof nonce === "undefined") {
				const requestChainId = rest.chainId;
				const chainId = await (async () => {
					if (typeof requestChainId === "number") return requestChainId;
					if (chain) return chain.id;
					return getAction(client, getChainId, "getChainId")({});
				})();
				nonceManagerParameters = {
					address: account.address,
					chainId
				};
			}
			const request = await getAction(client, prepareTransactionRequest, "prepareTransactionRequest")({
				account,
				accessList,
				authorizationList,
				blobs,
				chain,
				data: dataSuffix ? concat([data ?? "0x", dataSuffix]) : data,
				gas,
				gasPrice,
				maxFeePerBlobGas,
				maxFeePerGas,
				maxPriorityFeePerGas,
				nonce,
				nonceManager: account.nonceManager,
				parameters: [...defaultParameters, "sidecars"],
				type,
				value,
				...rest,
				to
			});
			const serializer = chain?.serializers?.transaction;
			const serializedTransaction = await account.signTransaction(request, { serializer });
			return await getAction(client, sendRawTransaction, "sendRawTransaction")({ serializedTransaction });
		}
		if (account?.type === "smart") throw new AccountTypeNotSupportedError({
			metaMessages: ["Consider using the `sendUserOperation` Action instead."],
			docsPath: "/docs/actions/bundler/sendUserOperation",
			type: "smart"
		});
		throw new AccountTypeNotSupportedError({
			docsPath: "/docs/actions/wallet/sendTransaction",
			type: account?.type
		});
	} catch (err) {
		if (err instanceof AccountTypeNotSupportedError) throw err;
		if (nonceManagerParameters) account?.nonceManager?.reset(nonceManagerParameters);
		throw getTransactionError(err, {
			...parameters,
			account,
			chain: parameters.chain || void 0
		});
	}
}
//#endregion
//#region node_modules/viem/_esm/actions/wallet/writeContract.js
/**
* Executes a write function on a contract.
*
* - Docs: https://viem.sh/docs/contract/writeContract
* - Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/contracts_writing-to-contracts
*
* A "write" function on a Solidity contract modifies the state of the blockchain. These types of functions require gas to be executed, and hence a [Transaction](https://viem.sh/docs/glossary/terms) is needed to be broadcast in order to change the state.
*
* Internally, uses a [Wallet Client](https://viem.sh/docs/clients/wallet) to call the [`sendTransaction` action](https://viem.sh/docs/actions/wallet/sendTransaction) with [ABI-encoded `data`](https://viem.sh/docs/contract/encodeFunctionData).
*
* __Warning: The `write` internally sends a transaction – it does not validate if the contract write will succeed (the contract may throw an error). It is highly recommended to [simulate the contract write with `contract.simulate`](https://viem.sh/docs/contract/writeContract#usage) before you execute it.__
*
* @param client - Client to use
* @param parameters - {@link WriteContractParameters}
* @returns A [Transaction Hash](https://viem.sh/docs/glossary/terms#hash). {@link WriteContractReturnType}
*
* @example
* import { createWalletClient, custom, parseAbi } from 'viem'
* import { mainnet } from 'viem/chains'
* import { writeContract } from 'viem/contract'
*
* const client = createWalletClient({
*   chain: mainnet,
*   transport: custom(window.ethereum),
* })
* const hash = await writeContract(client, {
*   address: '0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2',
*   abi: parseAbi(['function mint(uint32 tokenId) nonpayable']),
*   functionName: 'mint',
*   args: [69420],
* })
*
* @example
* // With Validation
* import { createWalletClient, http, parseAbi } from 'viem'
* import { mainnet } from 'viem/chains'
* import { simulateContract, writeContract } from 'viem/contract'
*
* const client = createWalletClient({
*   chain: mainnet,
*   transport: http(),
* })
* const { request } = await simulateContract(client, {
*   address: '0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2',
*   abi: parseAbi(['function mint(uint32 tokenId) nonpayable']),
*   functionName: 'mint',
*   args: [69420],
* }
* const hash = await writeContract(client, request)
*/
async function writeContract(client, parameters) {
	return writeContract.internal(client, sendTransaction, "sendTransaction", parameters);
}
(function(writeContract) {
	async function internal(client, actionFn, name, parameters) {
		const { abi, account: account_ = client.account, address, args, functionName, ...request } = parameters;
		if (typeof account_ === "undefined") throw new AccountNotFoundError({ docsPath: "/docs/contract/writeContract" });
		const account = account_ ? parseAccount(account_) : null;
		const data = encodeFunctionData({
			abi,
			args,
			functionName
		});
		try {
			return await getAction(client, actionFn, name)({
				data,
				to: address,
				account,
				...request
			});
		} catch (error) {
			throw getContractError(error, {
				abi,
				address,
				args,
				docsPath: "/docs/contract/writeContract",
				functionName,
				sender: account?.address
			});
		}
	}
	writeContract.internal = internal;
})(writeContract || (writeContract = {}));
//#endregion
//#region node_modules/viem/_esm/utils/promise/withRetry.js
function withRetry(fn, { delay: delay_ = 100, retryCount = 2, shouldRetry = () => true, signal } = {}) {
	return new Promise((resolve, reject) => {
		const attemptRetry = async ({ count = 0 } = {}) => {
			if (signal?.aborted) {
				reject(getAbortError(signal));
				return;
			}
			const retry = async ({ error }) => {
				const delay = typeof delay_ === "function" ? delay_({
					count,
					error
				}) : delay_;
				if (delay) try {
					await wait(delay, { signal });
				} catch (err) {
					reject(err);
					return;
				}
				attemptRetry({ count: count + 1 });
			};
			try {
				resolve(await fn());
			} catch (err) {
				if (signal?.aborted) {
					reject(getAbortError(signal));
					return;
				}
				if (isAbortError(err)) {
					reject(err);
					return;
				}
				if (count < retryCount && await shouldRetry({
					count,
					error: err
				})) return retry({ error: err });
				reject(err);
			}
		};
		attemptRetry();
	});
}
//#endregion
//#region node_modules/viem/_esm/utils/formatters/transactionReceipt.js
var receiptStatuses = {
	"0x0": "reverted",
	"0x1": "success"
};
function formatTransactionReceipt(transactionReceipt, _) {
	const receipt = {
		...transactionReceipt,
		blockNumber: transactionReceipt.blockNumber ? BigInt(transactionReceipt.blockNumber) : null,
		contractAddress: transactionReceipt.contractAddress ? transactionReceipt.contractAddress : null,
		cumulativeGasUsed: transactionReceipt.cumulativeGasUsed ? BigInt(transactionReceipt.cumulativeGasUsed) : null,
		effectiveGasPrice: transactionReceipt.effectiveGasPrice ? BigInt(transactionReceipt.effectiveGasPrice) : null,
		gasUsed: transactionReceipt.gasUsed ? BigInt(transactionReceipt.gasUsed) : null,
		logs: transactionReceipt.logs ? transactionReceipt.logs.map((log) => formatLog(log)) : null,
		to: transactionReceipt.to ? transactionReceipt.to : null,
		transactionIndex: transactionReceipt.transactionIndex ? hexToNumber(transactionReceipt.transactionIndex) : null,
		status: transactionReceipt.status ? receiptStatuses[transactionReceipt.status] : null,
		type: transactionReceipt.type ? transactionType[transactionReceipt.type] || transactionReceipt.type : null
	};
	if (transactionReceipt.blobGasPrice) receipt.blobGasPrice = BigInt(transactionReceipt.blobGasPrice);
	if (transactionReceipt.blobGasUsed) receipt.blobGasUsed = BigInt(transactionReceipt.blobGasUsed);
	return receipt;
}
//#endregion
//#region node_modules/viem/_esm/utils/uid.js
var size = 256;
var index = size;
var buffer;
function uid(length = 11) {
	if (!buffer || index + length > size * 2) {
		buffer = "";
		index = 0;
		for (let i = 0; i < size; i++) buffer += (256 + Math.random() * 256 | 0).toString(16).substring(1);
	}
	return buffer.substring(index, index++ + length);
}
//#endregion
//#region node_modules/viem/_esm/clients/createClient.js
function createClient(parameters) {
	const { batch, chain, ccipRead, dataSuffix, key = "base", name = "Base Client", type = "base" } = parameters;
	const experimental_blockTag = parameters.experimental_blockTag ?? (typeof chain?.experimental_preconfirmationTime === "number" ? "pending" : void 0);
	const blockTime = chain?.blockTime ?? 12e3;
	const defaultPollingInterval = Math.min(Math.max(Math.floor(blockTime / 2), 500), 4e3);
	const pollingInterval = parameters.pollingInterval ?? defaultPollingInterval;
	const cacheTime = parameters.cacheTime ?? pollingInterval;
	const account = parameters.account ? parseAccount(parameters.account) : void 0;
	const { config, request, value } = parameters.transport({
		account,
		chain,
		pollingInterval
	});
	const client = {
		account,
		batch,
		cacheTime,
		ccipRead,
		chain,
		dataSuffix,
		key,
		name,
		pollingInterval,
		request,
		transport: {
			...config,
			...value
		},
		type,
		uid: uid(),
		...experimental_blockTag ? { experimental_blockTag } : {}
	};
	function extend(base) {
		return (extendFn) => {
			const extended = extendFn(base);
			for (const key in client) delete extended[key];
			const combined = {
				...base,
				...extended
			};
			return Object.assign(combined, { extend: extend(combined) });
		};
	}
	return Object.assign(client, { extend: extend(client) });
}
//#endregion
//#region node_modules/viem/_esm/utils/promise/withDedupe.js
/** @internal */
var promiseCache = /* @__PURE__ */ new LruMap(8192);
/** Deduplicates in-flight promises. */
function withDedupe(fn, { enabled = true, id }) {
	if (!enabled || !id) return fn();
	if (promiseCache.get(id)) return promiseCache.get(id);
	const promise = fn().finally(() => promiseCache.delete(id));
	promiseCache.set(id, promise);
	return promise;
}
//#endregion
//#region node_modules/viem/_esm/utils/buildRequest.js
function buildRequest(request, options = {}) {
	return async (args, overrideOptions = {}) => {
		const { dedupe = false, methods, retryDelay = 150, retryCount = 3, signal, uid } = {
			...options,
			...overrideOptions
		};
		const { method } = args;
		if (methods?.exclude?.includes(method)) throw new MethodNotSupportedRpcError(/* @__PURE__ */ new Error("method not supported"), { method });
		if (methods?.include && !methods.include.includes(method)) throw new MethodNotSupportedRpcError(/* @__PURE__ */ new Error("method not supported"), { method });
		if (signal?.aborted) throw getAbortError(signal);
		return withDedupe(() => withRetry(async () => {
			try {
				return await request(args, signal ? { signal } : void 0);
			} catch (err_) {
				if (signal?.aborted) throw getAbortError(signal);
				if (isAbortError(err_)) throw err_;
				const err = err_;
				switch (err.code) {
					case ParseRpcError.code: throw new ParseRpcError(err);
					case InvalidRequestRpcError.code: throw new InvalidRequestRpcError(err);
					case MethodNotFoundRpcError.code: throw new MethodNotFoundRpcError(err, { method: args.method });
					case InvalidParamsRpcError.code: throw new InvalidParamsRpcError(err);
					case InternalRpcError.code: throw new InternalRpcError(err);
					case InvalidInputRpcError.code: throw new InvalidInputRpcError(err);
					case ResourceNotFoundRpcError.code: throw new ResourceNotFoundRpcError(err);
					case ResourceUnavailableRpcError.code: throw new ResourceUnavailableRpcError(err);
					case TransactionRejectedRpcError.code: throw new TransactionRejectedRpcError(err);
					case MethodNotSupportedRpcError.code: throw new MethodNotSupportedRpcError(err, { method: args.method });
					case LimitExceededRpcError.code: throw new LimitExceededRpcError(err);
					case JsonRpcVersionUnsupportedError.code: throw new JsonRpcVersionUnsupportedError(err);
					case UserRejectedRequestError.code: throw new UserRejectedRequestError(err);
					case UnauthorizedProviderError.code: throw new UnauthorizedProviderError(err);
					case UnsupportedProviderMethodError.code: throw new UnsupportedProviderMethodError(err);
					case ProviderDisconnectedError.code: throw new ProviderDisconnectedError(err);
					case ChainDisconnectedError.code: throw new ChainDisconnectedError(err);
					case SwitchChainError.code: throw new SwitchChainError(err);
					case UnsupportedNonOptionalCapabilityError.code: throw new UnsupportedNonOptionalCapabilityError(err);
					case UnsupportedChainIdError.code: throw new UnsupportedChainIdError(err);
					case DuplicateIdError.code: throw new DuplicateIdError(err);
					case UnknownBundleIdError.code: throw new UnknownBundleIdError(err);
					case BundleTooLargeError.code: throw new BundleTooLargeError(err);
					case AtomicReadyWalletRejectedUpgradeError.code: throw new AtomicReadyWalletRejectedUpgradeError(err);
					case AtomicityNotSupportedError.code: throw new AtomicityNotSupportedError(err);
					case 5e3: throw new UserRejectedRequestError(err);
					case WalletConnectSessionSettlementError.code: throw new WalletConnectSessionSettlementError(err);
					default:
						if (err_ instanceof BaseError) throw err_;
						throw new UnknownRpcError(err);
				}
			}
		}, {
			delay: ({ count, error }) => {
				if (error && error instanceof HttpRequestError) {
					const retryAfter = error?.headers?.get("Retry-After");
					if (retryAfter?.match(/\d/)) return Number.parseInt(retryAfter, 10) * 1e3;
				}
				return ~~(1 << count) * retryDelay;
			},
			retryCount,
			signal,
			shouldRetry: ({ error }) => shouldRetry(error)
		}), {
			enabled: dedupe,
			id: dedupe ? hashString(`${uid}.${stringify(args)}`) : void 0
		});
	};
}
/** @internal */
function shouldRetry(error) {
	if (isAbortError(error)) return false;
	if ("code" in error && typeof error.code === "number") {
		if (error.code === -1) return true;
		if (error.code === LimitExceededRpcError.code) return true;
		if (error.code === InternalRpcError.code) return true;
		if (error.code === 429) return true;
		return false;
	}
	if (error instanceof HttpRequestError && error.status) {
		if (error.status === 403) return true;
		if (error.status === 408) return true;
		if (error.status === 413) return true;
		if (error.status === 429) return true;
		if (error.status === 500) return true;
		if (error.status === 502) return true;
		if (error.status === 503) return true;
		if (error.status === 504) return true;
		return false;
	}
	return true;
}
/** @internal cyrb53 – fast, non-cryptographic 53-bit string hash */
function hashString(str, seed = 0) {
	let h1 = 3735928559 ^ seed;
	let h2 = 1103547991 ^ seed;
	for (let i = 0; i < str.length; i++) {
		const ch = str.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}
	h1 = Math.imul(h1 ^ h1 >>> 16, 2246822507);
	h1 ^= Math.imul(h2 ^ h2 >>> 16, 3266489909);
	h2 = Math.imul(h2 ^ h2 >>> 16, 2246822507);
	h2 ^= Math.imul(h1 ^ h1 >>> 16, 3266489909);
	return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
//#endregion
//#region node_modules/viem/_esm/utils/promise/withTimeout.js
function withTimeout(fn, { errorInstance = /* @__PURE__ */ new Error("timed out"), timeout, signal }) {
	return new Promise((resolve, reject) => {
		(async () => {
			let timeoutId;
			const controller = new AbortController();
			try {
				if (timeout > 0) timeoutId = setTimeout(() => {
					if (signal) controller.abort();
					else reject(errorInstance);
				}, timeout);
				resolve(await fn({ signal: controller?.signal || null }));
			} catch (err) {
				if (controller?.signal.aborted && isAbortError(err)) {
					reject(errorInstance);
					return;
				}
				reject(err);
			} finally {
				clearTimeout(timeoutId);
			}
		})();
	});
}
//#endregion
//#region node_modules/viem/_esm/utils/rpc/id.js
function createIdStore() {
	return {
		current: 0,
		take() {
			return this.current++;
		},
		reset() {
			this.current = 0;
		}
	};
}
var idCache = /* @__PURE__ */ createIdStore();
//#endregion
//#region node_modules/viem/_esm/utils/rpc/http.js
function getHttpRpcClient(url_, options = {}) {
	const { url, headers: headers_url } = parseUrl(url_);
	return { async request(params) {
		const { body, fetchFn = options.fetchFn ?? fetch, onRequest = options.onRequest, onResponse = options.onResponse, timeout = options.timeout ?? 1e4 } = params;
		const fetchOptions = {
			...options.fetchOptions ?? {},
			...params.fetchOptions ?? {}
		};
		const { headers, method, signal: signal_ } = fetchOptions;
		try {
			const response = await withTimeout(async ({ signal }) => {
				const init = {
					...fetchOptions,
					body: Array.isArray(body) ? stringify(body.map((body) => ({
						jsonrpc: "2.0",
						id: body.id ?? idCache.take(),
						...body
					}))) : stringify({
						jsonrpc: "2.0",
						id: body.id ?? idCache.take(),
						...body
					}),
					headers: {
						...headers_url,
						"Content-Type": "application/json",
						...headers
					},
					method: method || "POST",
					signal: signal_ || (timeout > 0 ? signal : null)
				};
				const request = new Request(url, init);
				const args = await onRequest?.(request, init) ?? {
					...init,
					url
				};
				return await fetchFn(args.url ?? url, args);
			}, {
				errorInstance: new TimeoutError({
					body,
					url
				}),
				timeout,
				signal: true
			});
			if (onResponse) await onResponse(response);
			let data;
			if (response.headers.get("Content-Type")?.startsWith("application/json")) data = await response.json();
			else {
				data = await response.text();
				try {
					data = JSON.parse(data || "{}");
				} catch (err) {
					if (response.ok) throw err;
					data = { error: data };
				}
			}
			if (!response.ok) {
				if (typeof data.error?.code === "number" && typeof data.error?.message === "string") return data;
				throw new HttpRequestError({
					body,
					details: stringify(data.error) || response.statusText,
					headers: response.headers,
					status: response.status,
					url
				});
			}
			return data;
		} catch (err) {
			if (signal_?.aborted) throw getAbortError(signal_);
			if (isAbortError(err)) throw err;
			if (err instanceof HttpRequestError) throw err;
			if (err instanceof TimeoutError) throw err;
			throw new HttpRequestError({
				body,
				cause: err,
				url
			});
		}
	} };
}
/** @internal */
function parseUrl(url_) {
	try {
		const url = new URL(url_);
		const result = (() => {
			if (url.username) {
				const credentials = `${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`;
				url.username = "";
				url.password = "";
				return {
					url: url.toString(),
					headers: { Authorization: `Basic ${btoa(credentials)}` }
				};
			}
		})();
		return {
			url: url.toString(),
			...result
		};
	} catch {
		return { url: url_ };
	}
}
//#endregion
//#region node_modules/viem/_esm/actions/public/getTransaction.js
/**
* Returns information about a [Transaction](https://viem.sh/docs/glossary/terms#transaction) given a hash or block identifier.
*
* - Docs: https://viem.sh/docs/actions/public/getTransaction
* - Example: https://stackblitz.com/github/wevm/viem/tree/main/examples/transactions_fetching-transactions
* - JSON-RPC Methods: [`eth_getTransactionByHash`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getTransactionByHash)
*
* @param client - Client to use
* @param parameters - {@link GetTransactionParameters}
* @returns The transaction information. {@link GetTransactionReturnType}
*
* @example
* import { createPublicClient, http } from 'viem'
* import { mainnet } from 'viem/chains'
* import { getTransaction } from 'viem/public'
*
* const client = createPublicClient({
*   chain: mainnet,
*   transport: http(),
* })
* const transaction = await getTransaction(client, {
*   hash: '0x4ca7ee652d57678f26e887c149ab0735f41de37bcad58c9f6d3ed5824f15b74d',
* })
*/
async function getTransaction(client, { blockHash, blockNumber, blockTag: blockTag_, hash, index, sender, nonce }) {
	const blockTag = blockTag_ || "latest";
	const blockNumberHex = blockNumber !== void 0 ? numberToHex(blockNumber) : void 0;
	let transaction = null;
	if (hash) transaction = await client.request({
		method: "eth_getTransactionByHash",
		params: [hash]
	}, { dedupe: true });
	else if (blockHash) transaction = await client.request({
		method: "eth_getTransactionByBlockHashAndIndex",
		params: [blockHash, numberToHex(index)]
	}, { dedupe: true });
	else if ((blockNumberHex || blockTag) && typeof index === "number") transaction = await client.request({
		method: "eth_getTransactionByBlockNumberAndIndex",
		params: [blockNumberHex || blockTag, numberToHex(index)]
	}, { dedupe: Boolean(blockNumberHex) });
	else if (sender && typeof nonce === "number") transaction = await client.request({
		method: "eth_getTransactionBySenderAndNonce",
		params: [sender, numberToHex(nonce)]
	}, { dedupe: true });
	if (!transaction) throw new TransactionNotFoundError({
		blockHash,
		blockNumber,
		blockTag,
		hash,
		index
	});
	return (client.chain?.formatters?.transaction?.format || formatTransaction)(transaction, "getTransaction");
}
//#endregion
//#region node_modules/viem/_esm/actions/public/getTransactionReceipt.js
/**
* Returns the [Transaction Receipt](https://viem.sh/docs/glossary/terms#transaction-receipt) given a [Transaction](https://viem.sh/docs/glossary/terms#transaction) hash.
*
* - Docs: https://viem.sh/docs/actions/public/getTransactionReceipt
* - Example: https://stackblitz.com/github/wevm/viem/tree/main/examples/transactions_fetching-transactions
* - JSON-RPC Methods: [`eth_getTransactionReceipt`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_gettransactionreceipt)
*
* @param client - Client to use
* @param parameters - {@link GetTransactionReceiptParameters}
* @returns The transaction receipt. {@link GetTransactionReceiptReturnType}
*
* @example
* import { createPublicClient, http } from 'viem'
* import { mainnet } from 'viem/chains'
* import { getTransactionReceipt } from 'viem/public'
*
* const client = createPublicClient({
*   chain: mainnet,
*   transport: http(),
* })
* const transactionReceipt = await getTransactionReceipt(client, {
*   hash: '0x4ca7ee652d57678f26e887c149ab0735f41de37bcad58c9f6d3ed5824f15b74d',
* })
*/
async function getTransactionReceipt(client, { hash }) {
	const receipt = await client.request({
		method: "eth_getTransactionReceipt",
		params: [hash]
	}, { dedupe: true });
	if (!receipt) throw new TransactionReceiptNotFoundError({ hash });
	return (client.chain?.formatters?.transactionReceipt?.format || formatTransactionReceipt)(receipt, "getTransactionReceipt");
}
//#endregion
//#region node_modules/viem/_esm/actions/public/watchBlockNumber.js
/**
* Watches and returns incoming block numbers.
*
* - Docs: https://viem.sh/docs/actions/public/watchBlockNumber
* - Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/blocks_watching-blocks
* - JSON-RPC Methods:
*   - When `poll: true`, calls [`eth_blockNumber`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_blocknumber) on a polling interval.
*   - When `poll: false` & WebSocket Transport, uses a WebSocket subscription via [`eth_subscribe`](https://docs.alchemy.com/reference/eth-subscribe-polygon) and the `"newHeads"` event.
*
* @param client - Client to use
* @param parameters - {@link WatchBlockNumberParameters}
* @returns A function that can be invoked to stop watching for new block numbers. {@link WatchBlockNumberReturnType}
*
* @example
* import { createPublicClient, watchBlockNumber, http } from 'viem'
* import { mainnet } from 'viem/chains'
*
* const client = createPublicClient({
*   chain: mainnet,
*   transport: http(),
* })
* const unwatch = watchBlockNumber(client, {
*   onBlockNumber: (blockNumber) => console.log(blockNumber),
* })
*/
function watchBlockNumber(client, { emitOnBegin = false, emitMissed = false, onBlockNumber, onError, poll: poll_, pollingInterval = client.pollingInterval }) {
	const enablePolling = (() => {
		if (typeof poll_ !== "undefined") return poll_;
		if (client.transport.type === "webSocket" || client.transport.type === "ipc") return false;
		if (client.transport.type === "fallback" && (client.transport.transports[0].config.type === "webSocket" || client.transport.transports[0].config.type === "ipc")) return false;
		return true;
	})();
	let prevBlockNumber;
	const pollBlockNumber = () => {
		return observe(stringify([
			"watchBlockNumber",
			client.uid,
			emitOnBegin,
			emitMissed,
			pollingInterval
		]), {
			onBlockNumber,
			onError
		}, (emit) => poll(async () => {
			try {
				const blockNumber = await getAction(client, getBlockNumber, "getBlockNumber")({ cacheTime: 0 });
				if (prevBlockNumber !== void 0) {
					if (blockNumber === prevBlockNumber) return;
					if (blockNumber - prevBlockNumber > 1 && emitMissed) for (let i = prevBlockNumber + 1n; i < blockNumber; i++) {
						emit.onBlockNumber(i, prevBlockNumber);
						prevBlockNumber = i;
					}
				}
				if (prevBlockNumber === void 0 || blockNumber > prevBlockNumber) {
					emit.onBlockNumber(blockNumber, prevBlockNumber);
					prevBlockNumber = blockNumber;
				}
			} catch (err) {
				emit.onError?.(err);
			}
		}, {
			emitOnBegin,
			interval: pollingInterval
		}));
	};
	const subscribeBlockNumber = () => {
		return observe(stringify([
			"watchBlockNumber",
			client.uid,
			emitOnBegin,
			emitMissed
		]), {
			onBlockNumber,
			onError
		}, (emit) => {
			let active = true;
			let unsubscribe = () => active = false;
			(async () => {
				try {
					const { unsubscribe: unsubscribe_ } = await (() => {
						if (client.transport.type === "fallback") {
							const transport = client.transport.transports.find((transport) => transport.config.type === "webSocket" || transport.config.type === "ipc");
							if (!transport) return client.transport;
							return transport.value;
						}
						return client.transport;
					})().subscribe({
						params: ["newHeads"],
						onData(data) {
							if (!active) return;
							const blockNumber = hexToBigInt(data.result?.number);
							emit.onBlockNumber(blockNumber, prevBlockNumber);
							prevBlockNumber = blockNumber;
						},
						onError(error) {
							emit.onError?.(error);
						}
					});
					unsubscribe = unsubscribe_;
					if (!active) unsubscribe();
				} catch (err) {
					onError?.(err);
				}
			})();
			return () => unsubscribe();
		});
	};
	return enablePolling ? pollBlockNumber() : subscribeBlockNumber();
}
//#endregion
//#region node_modules/viem/_esm/actions/public/waitForTransactionReceipt.js
/**
* Waits for the [Transaction](https://viem.sh/docs/glossary/terms#transaction) to be included on a [Block](https://viem.sh/docs/glossary/terms#block) (one confirmation), and then returns the [Transaction Receipt](https://viem.sh/docs/glossary/terms#transaction-receipt).
*
* - Docs: https://viem.sh/docs/actions/public/waitForTransactionReceipt
* - Example: https://stackblitz.com/github/wevm/viem/tree/main/examples/transactions_sending-transactions
* - JSON-RPC Methods:
*   - Polls [`eth_getTransactionReceipt`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getTransactionReceipt) on each block until it has been processed.
*   - If a Transaction has been replaced:
*     - Calls [`eth_getBlockByNumber`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getblockbynumber) and extracts the transactions
*     - Checks if one of the Transactions is a replacement
*     - If so, calls [`eth_getTransactionReceipt`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getTransactionReceipt).
*
* The `waitForTransactionReceipt` action additionally supports Replacement detection (e.g. sped up Transactions).
*
* Transactions can be replaced when a user modifies their transaction in their wallet (to speed up or cancel). Transactions are replaced when they are sent from the same nonce.
*
* There are 3 types of Transaction Replacement reasons:
*
* - `repriced`: The gas price has been modified (e.g. different `maxFeePerGas`)
* - `cancelled`: The Transaction has been cancelled (e.g. `value === 0n`)
* - `replaced`: The Transaction has been replaced (e.g. different `value` or `data`)
*
* @param client - Client to use
* @param parameters - {@link WaitForTransactionReceiptParameters}
* @returns The transaction receipt. {@link WaitForTransactionReceiptReturnType}
*
* @example
* import { createPublicClient, waitForTransactionReceipt, http } from 'viem'
* import { mainnet } from 'viem/chains'
*
* const client = createPublicClient({
*   chain: mainnet,
*   transport: http(),
* })
* const transactionReceipt = await waitForTransactionReceipt(client, {
*   hash: '0x4ca7ee652d57678f26e887c149ab0735f41de37bcad58c9f6d3ed5824f15b74d',
* })
*/
async function waitForTransactionReceipt(client, parameters) {
	const { checkReplacement = true, confirmations = 1, hash, onReplaced, retryCount = 6, retryDelay = ({ count }) => ~~(1 << count) * 200, timeout = 18e4 } = parameters;
	const observerId = stringify([
		"waitForTransactionReceipt",
		client.uid,
		hash
	]);
	const pollingInterval = (() => {
		if (parameters.pollingInterval) return parameters.pollingInterval;
		if (client.chain?.experimental_preconfirmationTime) return client.chain.experimental_preconfirmationTime;
		return client.pollingInterval;
	})();
	let transaction;
	let replacedTransaction;
	let receipt;
	let retrying = false;
	let _unobserve;
	let _unwatch;
	const { promise, resolve, reject } = withResolvers();
	const timer = timeout ? setTimeout(() => {
		_unwatch?.();
		_unobserve?.();
		reject(new WaitForTransactionReceiptTimeoutError({ hash }));
	}, timeout) : void 0;
	_unobserve = observe(observerId, {
		onReplaced,
		resolve,
		reject
	}, async (emit) => {
		receipt = await getAction(client, getTransactionReceipt, "getTransactionReceipt")({ hash }).catch(() => void 0);
		if (receipt && confirmations <= 1) {
			clearTimeout(timer);
			emit.resolve(receipt);
			_unobserve?.();
			return;
		}
		_unwatch = getAction(client, watchBlockNumber, "watchBlockNumber")({
			emitMissed: true,
			emitOnBegin: true,
			poll: true,
			pollingInterval,
			async onBlockNumber(blockNumber_) {
				const done = (fn) => {
					clearTimeout(timer);
					_unwatch?.();
					fn();
					_unobserve?.();
				};
				let blockNumber = blockNumber_;
				if (retrying) return;
				try {
					if (receipt) {
						if (confirmations > 1 && (!receipt.blockNumber || blockNumber - receipt.blockNumber + 1n < confirmations)) return;
						done(() => emit.resolve(receipt));
						return;
					}
					if (checkReplacement && !transaction) {
						retrying = true;
						await withRetry(async () => {
							transaction = await getAction(client, getTransaction, "getTransaction")({ hash });
							if (transaction.blockNumber) blockNumber = transaction.blockNumber;
						}, {
							delay: retryDelay,
							retryCount
						});
						retrying = false;
					}
					receipt = await getAction(client, getTransactionReceipt, "getTransactionReceipt")({ hash });
					if (confirmations > 1 && (!receipt.blockNumber || blockNumber - receipt.blockNumber + 1n < confirmations)) return;
					done(() => emit.resolve(receipt));
				} catch (err) {
					if (err instanceof TransactionNotFoundError || err instanceof TransactionReceiptNotFoundError) {
						if (!transaction) {
							retrying = false;
							return;
						}
						try {
							replacedTransaction = transaction;
							retrying = true;
							const block = await withRetry(() => getAction(client, getBlock, "getBlock")({
								blockNumber,
								includeTransactions: true
							}), {
								delay: retryDelay,
								retryCount,
								shouldRetry: ({ error }) => error instanceof BlockNotFoundError
							});
							retrying = false;
							const replacementTransaction = block.transactions.find(({ from, nonce }) => from === replacedTransaction.from && nonce === replacedTransaction.nonce);
							if (!replacementTransaction) return;
							receipt = await getAction(client, getTransactionReceipt, "getTransactionReceipt")({ hash: replacementTransaction.hash });
							if (confirmations > 1 && (!receipt.blockNumber || blockNumber - receipt.blockNumber + 1n < confirmations)) return;
							let reason = "replaced";
							if (replacementTransaction.to === replacedTransaction.to && replacementTransaction.value === replacedTransaction.value && replacementTransaction.input === replacedTransaction.input) reason = "repriced";
							else if (replacementTransaction.from === replacementTransaction.to && replacementTransaction.value === 0n) reason = "cancelled";
							done(() => {
								emit.onReplaced?.({
									reason,
									replacedTransaction,
									transaction: replacementTransaction,
									transactionReceipt: receipt
								});
								emit.resolve(receipt);
							});
						} catch (err_) {
							done(() => emit.reject(err_));
						}
					} else done(() => emit.reject(err));
				}
			}
		});
	});
	return promise;
}
//#endregion
//#region node_modules/viem/_esm/actions/wallet/signMessage.js
/**
* Calculates an Ethereum-specific signature in [EIP-191 format](https://eips.ethereum.org/EIPS/eip-191): `keccak256("\x19Ethereum Signed Message:\n" + len(message) + message))`.
*
* - Docs: https://viem.sh/docs/actions/wallet/signMessage
* - JSON-RPC Methods:
*   - JSON-RPC Accounts: [`personal_sign`](https://docs.metamask.io/guide/signing-data#personal-sign)
*   - Local Accounts: Signs locally. No JSON-RPC request.
*
* With the calculated signature, you can:
* - use [`verifyMessage`](https://viem.sh/docs/utilities/verifyMessage) to verify the signature,
* - use [`recoverMessageAddress`](https://viem.sh/docs/utilities/recoverMessageAddress) to recover the signing address from a signature.
*
* @param client - Client to use
* @param parameters - {@link SignMessageParameters}
* @returns The signed message. {@link SignMessageReturnType}
*
* @example
* import { createWalletClient, custom } from 'viem'
* import { mainnet } from 'viem/chains'
* import { signMessage } from 'viem/wallet'
*
* const client = createWalletClient({
*   chain: mainnet,
*   transport: custom(window.ethereum),
* })
* const signature = await signMessage(client, {
*   account: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
*   message: 'hello world',
* })
*
* @example
* // Account Hoisting
* import { createWalletClient, custom } from 'viem'
* import { privateKeyToAccount } from 'viem/accounts'
* import { mainnet } from 'viem/chains'
* import { signMessage } from 'viem/wallet'
*
* const client = createWalletClient({
*   account: privateKeyToAccount('0x…'),
*   chain: mainnet,
*   transport: custom(window.ethereum),
* })
* const signature = await signMessage(client, {
*   message: 'hello world',
* })
*/
async function signMessage(client, { account: account_ = client.account, message }) {
	if (!account_) throw new AccountNotFoundError({ docsPath: "/docs/actions/wallet/signMessage" });
	const account = parseAccount(account_);
	if (account.signMessage) return account.signMessage({ message });
	const message_ = (() => {
		if (typeof message === "string") return stringToHex(message);
		if (message.raw instanceof Uint8Array) return toHex(message.raw);
		return message.raw;
	})();
	return client.request({
		method: "personal_sign",
		params: [message_, account.address]
	}, { retryCount: 0 });
}
//#endregion
//#region node_modules/viem/_esm/actions/wallet/switchChain.js
/**
* Switch the target chain in a wallet.
*
* - Docs: https://viem.sh/docs/actions/wallet/switchChain
* - JSON-RPC Methods: [`wallet_switchEthereumChain`](https://eips.ethereum.org/EIPS/eip-3326)
*
* @param client - Client to use
* @param parameters - {@link SwitchChainParameters}
*
* @example
* import { createWalletClient, custom } from 'viem'
* import { mainnet, optimism } from 'viem/chains'
* import { switchChain } from 'viem/wallet'
*
* const client = createWalletClient({
*   chain: mainnet,
*   transport: custom(window.ethereum),
* })
* await switchChain(client, { id: optimism.id })
*/
async function switchChain(client, { id }) {
	await client.request({
		method: "wallet_switchEthereumChain",
		params: [{ chainId: numberToHex(id) }]
	}, { retryCount: 0 });
}
//#endregion
//#region node_modules/viem/_esm/clients/transports/createTransport.js
/**
* @description Creates an transport intended to be used with a client.
*/
function createTransport({ key, methods, name, request, retryCount = 3, retryDelay = 150, timeout, type }, value) {
	const uid$1 = uid();
	return {
		config: {
			key,
			methods,
			name,
			request,
			retryCount,
			retryDelay,
			timeout,
			type
		},
		request: buildRequest(request, {
			methods,
			retryCount,
			retryDelay,
			uid: uid$1
		}),
		value
	};
}
//#endregion
//#region node_modules/viem/_esm/clients/transports/custom.js
/**
* @description Creates a custom transport given an EIP-1193 compliant `request` attribute.
*/
function custom(provider, config = {}) {
	const { key = "custom", methods, name = "Custom Provider", retryDelay } = config;
	return ({ retryCount: defaultRetryCount }) => createTransport({
		key,
		methods,
		name,
		request: provider.request.bind(provider),
		retryCount: config.retryCount ?? defaultRetryCount,
		retryDelay,
		type: "custom"
	});
}
//#endregion
//#region node_modules/viem/_esm/clients/transports/fallback.js
function fallback(transports_, config = {}) {
	const { key = "fallback", name = "Fallback", rank = false, shouldThrow: shouldThrow_ = shouldThrow, retryCount, retryDelay } = config;
	return (({ chain, pollingInterval = 4e3, timeout, ...rest }) => {
		let transports = transports_;
		let onResponse = () => {};
		const transport = createTransport({
			key,
			name,
			async request({ method, params }) {
				let includes;
				const fetch = async (i = 0) => {
					const transport = transports[i]({
						...rest,
						chain,
						retryCount: 0,
						timeout
					});
					try {
						const response = await transport.request({
							method,
							params
						});
						onResponse({
							method,
							params,
							response,
							transport,
							status: "success"
						});
						return response;
					} catch (err) {
						onResponse({
							error: err,
							method,
							params,
							transport,
							status: "error"
						});
						if (shouldThrow_(err)) throw err;
						if (i === transports.length - 1) throw err;
						includes ??= transports.slice(i + 1).some((transport) => {
							const { include, exclude } = transport({ chain }).config.methods || {};
							if (include) return include.includes(method);
							if (exclude) return !exclude.includes(method);
							return true;
						});
						if (!includes) throw err;
						return fetch(i + 1);
					}
				};
				return fetch();
			},
			retryCount,
			retryDelay,
			type: "fallback"
		}, {
			onResponse: (fn) => onResponse = fn,
			transports: transports.map((fn) => fn({
				chain,
				retryCount: 0
			}))
		});
		if (rank) {
			const rankOptions = typeof rank === "object" ? rank : {};
			rankTransports({
				chain,
				interval: rankOptions.interval ?? pollingInterval,
				onTransports: (transports_) => transports = transports_,
				ping: rankOptions.ping,
				sampleCount: rankOptions.sampleCount,
				timeout: rankOptions.timeout,
				transports,
				weights: rankOptions.weights
			});
		}
		return transport;
	});
}
function shouldThrow(error) {
	if ("code" in error && typeof error.code === "number") {
		if (error.code === TransactionRejectedRpcError.code || error.code === UserRejectedRequestError.code || error.code === WalletConnectSessionSettlementError.code || ExecutionRevertedError.nodeMessage.test(error.message) || error.code === 5e3) return true;
	}
	return false;
}
/** @internal */
function rankTransports({ chain, interval = 4e3, onTransports, ping, sampleCount = 10, timeout = 1e3, transports, weights = {} }) {
	const { stability: stabilityWeight = .7, latency: latencyWeight = .3 } = weights;
	const samples = [];
	const rankTransports_ = async () => {
		const sample = await Promise.all(transports.map(async (transport) => {
			const transport_ = transport({
				chain,
				retryCount: 0,
				timeout
			});
			const start = Date.now();
			let end;
			let success;
			try {
				await (ping ? ping({ transport: transport_ }) : transport_.request({ method: "net_listening" }));
				success = 1;
			} catch {
				success = 0;
			} finally {
				end = Date.now();
			}
			return {
				latency: end - start,
				success
			};
		}));
		samples.push(sample);
		if (samples.length > sampleCount) samples.shift();
		const maxLatency = Math.max(...samples.map((sample) => Math.max(...sample.map(({ latency }) => latency))));
		onTransports(transports.map((_, i) => {
			const latencies = samples.map((sample) => sample[i].latency);
			const latencyScore = 1 - latencies.reduce((acc, latency) => acc + latency, 0) / latencies.length / maxLatency;
			const successes = samples.map((sample) => sample[i].success);
			const stabilityScore = successes.reduce((acc, success) => acc + success, 0) / successes.length;
			if (stabilityScore === 0) return [0, i];
			return [latencyWeight * latencyScore + stabilityWeight * stabilityScore, i];
		}).sort((a, b) => b[0] - a[0]).map(([, i]) => transports[i]));
		await wait(interval);
		rankTransports_();
	};
	rankTransports_();
}
//#endregion
//#region node_modules/viem/_esm/errors/transport.js
var UrlRequiredError = class extends BaseError {
	constructor() {
		super("No URL was provided to the Transport. Please provide a valid RPC URL to the Transport.", {
			docsPath: "/docs/clients/intro",
			name: "UrlRequiredError"
		});
	}
};
//#endregion
//#region node_modules/viem/_esm/clients/transports/http.js
var signalId = 0;
var signalIds = /* @__PURE__ */ new WeakMap();
function getSignalId(signal) {
	if (!signal) return "default";
	const id = signalIds.get(signal);
	if (id !== void 0) return id;
	const nextId = signalId++;
	signalIds.set(signal, nextId);
	return nextId;
}
/**
* @description Creates a HTTP transport that connects to a JSON-RPC API.
*/
function http(url, config = {}) {
	const { batch, fetchFn, fetchOptions, key = "http", methods, name = "HTTP JSON-RPC", onFetchRequest, onFetchResponse, retryDelay, raw } = config;
	return ({ chain, retryCount: retryCount_, timeout: timeout_ }) => {
		const { batchSize = 1e3, wait = 0 } = typeof batch === "object" ? batch : {};
		const retryCount = config.retryCount ?? retryCount_;
		const timeout = timeout_ ?? config.timeout ?? 1e4;
		const url_ = url || chain?.rpcUrls.default.http[0];
		if (!url_) throw new UrlRequiredError();
		const rpcClient = getHttpRpcClient(url_, {
			fetchFn,
			fetchOptions,
			onRequest: onFetchRequest,
			onResponse: onFetchResponse,
			timeout
		});
		return createTransport({
			key,
			methods,
			name,
			async request({ method, params }, options) {
				const body = {
					method,
					params
				};
				const fetchOptions = options?.signal ? { signal: options.signal } : void 0;
				const { schedule } = createBatchScheduler({
					id: `${url_}.${getSignalId(options?.signal)}`,
					wait,
					shouldSplitBatch(requests) {
						return requests.length > batchSize;
					},
					fn: (body) => rpcClient.request({
						body,
						fetchOptions
					}),
					sort: (a, b) => a.id - b.id
				});
				const fn = async (body) => batch ? schedule(body) : [await rpcClient.request({
					body,
					fetchOptions
				})];
				const [{ error, result }] = await fn(body);
				if (raw) return {
					error,
					result
				};
				if (error) throw new RpcRequestError({
					body,
					error,
					url: url_
				});
				return result;
			},
			retryCount,
			retryDelay,
			timeout,
			type: "http"
		}, {
			fetchOptions,
			url: url_
		});
	};
}
//#endregion
//#region node_modules/@trustwallet/connect-eip155-react/dist/transport.js
/**
* Creates a Viem custom transport from an EIP155Provider
* @param provider - The EIP155Provider from the connected wallet
* @param chain - The chain to use for requests
*/
function createEIP155Transport(provider, chain) {
	return custom({ async request({ method, params }) {
		const chainId = `eip155:${chain.id}`;
		return await provider.request({
			request: {
				method,
				params
			},
			chainId
		});
	} });
}
//#endregion
//#region node_modules/@trustwallet/connect-eip155-react/dist/hooks/core.js
function eip155QueryKey(chain, action, options) {
	return [
		"eip155",
		"query",
		chain.id,
		action.name,
		...options ?? []
	];
}
function useEIP155Query(options) {
	const { client } = useTrustConnectContext();
	const { action, chain, request, queryOptions } = options;
	const transport = (0, import_react.useMemo)(() => {
		if (!queryOptions?.enabled) return;
		const namespace = client.getNamespace(EIP155_SCOPE.ID);
		if (!namespace) throw new NamespaceNotFoundError(EIP155_SCOPE.ID);
		const chainId = buildChainId({
			namespace: namespace.id,
			reference: chain.id
		});
		const rpcUrls = namespace?.rpcUrls?.[chainId];
		if (!rpcUrls?.length) return http();
		if (rpcUrls.length === 1) return http(rpcUrls[0]);
		return fallback(rpcUrls.map((url) => http(url)));
	}, [
		client,
		chain,
		queryOptions?.enabled
	]);
	const queryFn = (0, import_react.useCallback)(async () => {
		if (!transport) throw new Error("Transport is undefined");
		return action(createClient({
			chain,
			transport
		}), request);
	}, [
		chain,
		transport,
		action,
		request
	]);
	const { queryKey, ...reactQueryOptions } = queryOptions ?? {};
	return { ...useQuery({
		queryKey: chain ? eip155QueryKey(chain, action, queryKey) : [],
		queryFn,
		...reactQueryOptions
	}) };
}
function useEIP155Mutation(options) {
	const { connection } = useConnection({ namespaceId: EIP155_SCOPE.ID });
	const { action, request: defaultRequest, mutationOptions, chain } = options;
	return useMutation({
		mutationFn: (0, import_react.useCallback)(async (request) => {
			if (connection?.status !== "connected") throw new NoWalletConnectedError();
			const requestToUse = request ?? defaultRequest;
			if (!requestToUse) throw new MissingRequiredParamError("request", "Pass them to the hook or to the mutate function.");
			return action(createClient({
				chain,
				transport: createEIP155Transport(await connection.wallet.getProvider(), chain)
			}), requestToUse);
		}, [
			connection,
			defaultRequest,
			action,
			chain
		]),
		...mutationOptions
	});
}
//#endregion
//#region node_modules/@trustwallet/connect-eip155-react/dist/hooks/useSendTransaction.js
function useSendTransaction(options = {}) {
	const { connection } = useConnection({ namespaceId: EIP155_SCOPE.ID });
	const { request: defaultRequest, mutationOptions, autoSwitchChain, receiptOptions, waitQueryOptions } = options;
	const getClient = (0, import_react.useCallback)(async (chainToUse) => {
		if (connection?.status !== "connected") throw new NoWalletConnectedError();
		const provider = await connection.wallet.getProvider();
		return createClient({
			chain: chainToUse,
			account: connection.address,
			transport: createEIP155Transport(provider, chainToUse)
		});
	}, [connection]);
	const lastChainRef = (0, import_react.useRef)(null);
	const sendMutation = useMutation({
		mutationFn: async (request) => {
			const requestToUse = request ?? defaultRequest;
			if (!requestToUse) throw new MissingRequiredParamError("request", "Pass them to the hook or to the sendTransaction function.");
			const chainToUse = requestToUse.chain;
			if (!chainToUse) throw new MissingChainError(EIP155_SCOPE.ID);
			lastChainRef.current = chainToUse;
			const viemClient = await getClient(chainToUse);
			if (autoSwitchChain !== false && Number(connection?.chain?.reference) !== chainToUse.id) await switchChain(viemClient, { id: chainToUse.id });
			return sendTransaction(viemClient, { ...requestToUse });
		},
		...mutationOptions
	});
	const hash = sendMutation.data;
	const address = connection?.address;
	const chainForReceipt = lastChainRef.current;
	const waitQuery = useQuery({
		queryKey: [
			EIP155_SCOPE.ID,
			waitForTransactionReceipt.name,
			address,
			hash,
			chainForReceipt?.id
		],
		queryFn: async () => {
			if (!hash) throw new Error("Transaction hash is missing");
			if (!chainForReceipt) throw new MissingChainError(EIP155_SCOPE.ID);
			return waitForTransactionReceipt(await getClient(chainForReceipt), {
				hash,
				...receiptOptions
			});
		},
		enabled: Boolean(hash),
		refetchOnWindowFocus: false,
		refetchOnMount: false,
		refetchOnReconnect: false,
		...waitQueryOptions
	});
	return {
		...sendMutation,
		sendTransaction: sendMutation.mutate,
		sendTransactionAsync: sendMutation.mutateAsync,
		isConfirming: waitQuery.isFetching,
		isConfirmed: waitQuery.isSuccess,
		error: sendMutation.error ?? waitQuery.error,
		hash: sendMutation.data,
		receipt: waitQuery.data
	};
}
//#endregion
//#region node_modules/@trustwallet/connect-eip155-react/dist/hooks/useSignMessage.js
function useSignMessage(options = {}) {
	const { connection } = useConnection({ namespaceId: EIP155_SCOPE.ID });
	const { mutationOptions } = options;
	const getClient = (0, import_react.useCallback)(async () => {
		if (connection?.status !== "connected") throw new NoWalletConnectedError();
		const provider = await connection.wallet.getProvider();
		return { client: createClient({
			account: connection.address,
			transport: createEIP155Transport(provider, { id: 0 })
		}) };
	}, [connection]);
	return useMutation({
		mutationFn: async ({ message }) => {
			const { client: viemClient } = await getClient();
			return signMessage(viemClient, { message });
		},
		...mutationOptions
	});
}
//#endregion
//#region node_modules/@trustwallet/connect-eip155-react/dist/hooks/useWriteContract.js
function useWriteContract(options = {}) {
	const { connection } = useConnection({ namespaceId: EIP155_SCOPE.ID });
	const { request: defaultRequest, mutationOptions, autoSwitchChain, receiptOptions, waitQueryOptions } = options;
	const getClient = (0, import_react.useCallback)(async (chainToUse) => {
		if (connection?.status !== "connected") throw new NoWalletConnectedError();
		const provider = await connection.wallet.getProvider();
		return createClient({
			chain: chainToUse,
			account: connection.address,
			transport: createEIP155Transport(provider, chainToUse)
		});
	}, [connection]);
	const lastChainRef = (0, import_react.useRef)(null);
	const writeMutation = useMutation({
		mutationFn: async (request) => {
			const requestToUse = request ?? defaultRequest;
			if (!requestToUse) throw new MissingRequiredParamError("request", "Pass them to the hook or to the writeContract function.");
			const chainToUse = requestToUse.chain;
			if (!chainToUse) throw new MissingChainError(EIP155_SCOPE.ID);
			lastChainRef.current = chainToUse;
			const viemClient = await getClient(chainToUse);
			if (autoSwitchChain !== false && Number(connection?.chain?.reference) !== chainToUse.id) await switchChain(viemClient, { id: chainToUse.id });
			return writeContract(viemClient, { ...requestToUse });
		},
		...mutationOptions
	});
	const hash = writeMutation.data;
	const address = connection?.address;
	const chainForReceipt = lastChainRef.current;
	const waitQuery = useQuery({
		queryKey: [
			EIP155_SCOPE.ID,
			waitForTransactionReceipt.name,
			address,
			hash,
			chainForReceipt?.id
		],
		queryFn: async () => {
			if (!hash) throw new Error("Transaction hash is missing");
			if (!chainForReceipt) throw new MissingChainError(EIP155_SCOPE.ID);
			return waitForTransactionReceipt(await getClient(chainForReceipt), {
				hash,
				...receiptOptions
			});
		},
		enabled: Boolean(hash),
		refetchOnWindowFocus: false,
		refetchOnMount: false,
		refetchOnReconnect: false,
		...waitQueryOptions
	});
	return {
		...writeMutation,
		writeContract: writeMutation.mutate,
		writeContractAsync: writeMutation.mutateAsync,
		isConfirming: waitQuery.isFetching,
		isConfirmed: waitQuery.isSuccess,
		error: writeMutation.error ?? waitQuery.error,
		hash: writeMutation.data,
		receipt: waitQuery.data
	};
}
//#endregion
//#region node_modules/@trustwallet/connect-eip155-react/dist/index.js
function formatChainId(chainId) {
	return buildChainId({
		namespace: EIP155_SCOPE.ID,
		reference: chainId
	});
}
//#endregion
export { createEIP155, eip155QueryKey, formatChainId, useEIP155Mutation, useEIP155Query, useSendTransaction, useSignMessage, useWriteContract };

//# sourceMappingURL=@trustwallet_connect-eip155-react.js.map