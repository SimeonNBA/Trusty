import { n as __commonJSMin, r as __toESM, t as require_react } from "./react-CoTh1R2n.js";
//#region node_modules/react/cjs/react-jsx-runtime.development.js
/**
* @license React
* react-jsx-runtime.development.js
*
* Copyright (c) Meta Platforms, Inc. and affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_react_jsx_runtime_development = /* @__PURE__ */ __commonJSMin(((exports) => {
	(function() {
		function getComponentNameFromType(type) {
			if (null == type) return null;
			if ("function" === typeof type) return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
			if ("string" === typeof type) return type;
			switch (type) {
				case REACT_FRAGMENT_TYPE: return "Fragment";
				case REACT_PROFILER_TYPE: return "Profiler";
				case REACT_STRICT_MODE_TYPE: return "StrictMode";
				case REACT_SUSPENSE_TYPE: return "Suspense";
				case REACT_SUSPENSE_LIST_TYPE: return "SuspenseList";
				case REACT_ACTIVITY_TYPE: return "Activity";
			}
			if ("object" === typeof type) switch ("number" === typeof type.tag && console.error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), type.$$typeof) {
				case REACT_PORTAL_TYPE: return "Portal";
				case REACT_CONTEXT_TYPE: return type.displayName || "Context";
				case REACT_CONSUMER_TYPE: return (type._context.displayName || "Context") + ".Consumer";
				case REACT_FORWARD_REF_TYPE:
					var innerType = type.render;
					type = type.displayName;
					type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
					return type;
				case REACT_MEMO_TYPE: return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
				case REACT_LAZY_TYPE:
					innerType = type._payload;
					type = type._init;
					try {
						return getComponentNameFromType(type(innerType));
					} catch (x) {}
			}
			return null;
		}
		function testStringCoercion(value) {
			return "" + value;
		}
		function checkKeyStringCoercion(value) {
			try {
				testStringCoercion(value);
				var JSCompiler_inline_result = !1;
			} catch (e) {
				JSCompiler_inline_result = !0;
			}
			if (JSCompiler_inline_result) {
				JSCompiler_inline_result = console;
				var JSCompiler_temp_const = JSCompiler_inline_result.error;
				var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
				JSCompiler_temp_const.call(JSCompiler_inline_result, "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.", JSCompiler_inline_result$jscomp$0);
				return testStringCoercion(value);
			}
		}
		function getTaskName(type) {
			if (type === REACT_FRAGMENT_TYPE) return "<>";
			if ("object" === typeof type && null !== type && type.$$typeof === REACT_LAZY_TYPE) return "<...>";
			try {
				var name = getComponentNameFromType(type);
				return name ? "<" + name + ">" : "<...>";
			} catch (x) {
				return "<...>";
			}
		}
		function getOwner() {
			var dispatcher = ReactSharedInternals.A;
			return null === dispatcher ? null : dispatcher.getOwner();
		}
		function UnknownOwner() {
			return Error("react-stack-top-frame");
		}
		function hasValidKey(config) {
			if (hasOwnProperty.call(config, "key")) {
				var getter = Object.getOwnPropertyDescriptor(config, "key").get;
				if (getter && getter.isReactWarning) return !1;
			}
			return void 0 !== config.key;
		}
		function defineKeyPropWarningGetter(props, displayName) {
			function warnAboutAccessingKey() {
				specialPropKeyWarningShown || (specialPropKeyWarningShown = !0, console.error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)", displayName));
			}
			warnAboutAccessingKey.isReactWarning = !0;
			Object.defineProperty(props, "key", {
				get: warnAboutAccessingKey,
				configurable: !0
			});
		}
		function elementRefGetterWithDeprecationWarning() {
			var componentName = getComponentNameFromType(this.type);
			didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = !0, console.error("Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."));
			componentName = this.props.ref;
			return void 0 !== componentName ? componentName : null;
		}
		function ReactElement(type, key, props, owner, debugStack, debugTask) {
			var refProp = props.ref;
			type = {
				$$typeof: REACT_ELEMENT_TYPE,
				type,
				key,
				props,
				_owner: owner
			};
			null !== (void 0 !== refProp ? refProp : null) ? Object.defineProperty(type, "ref", {
				enumerable: !1,
				get: elementRefGetterWithDeprecationWarning
			}) : Object.defineProperty(type, "ref", {
				enumerable: !1,
				value: null
			});
			type._store = {};
			Object.defineProperty(type._store, "validated", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: 0
			});
			Object.defineProperty(type, "_debugInfo", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: null
			});
			Object.defineProperty(type, "_debugStack", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: debugStack
			});
			Object.defineProperty(type, "_debugTask", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: debugTask
			});
			Object.freeze && (Object.freeze(type.props), Object.freeze(type));
			return type;
		}
		function jsxDEVImpl(type, config, maybeKey, isStaticChildren, debugStack, debugTask) {
			var children = config.children;
			if (void 0 !== children) if (isStaticChildren) if (isArrayImpl(children)) {
				for (isStaticChildren = 0; isStaticChildren < children.length; isStaticChildren++) validateChildKeys(children[isStaticChildren]);
				Object.freeze && Object.freeze(children);
			} else console.error("React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead.");
			else validateChildKeys(children);
			if (hasOwnProperty.call(config, "key")) {
				children = getComponentNameFromType(type);
				var keys = Object.keys(config).filter(function(k) {
					return "key" !== k;
				});
				isStaticChildren = 0 < keys.length ? "{key: someKey, " + keys.join(": ..., ") + ": ...}" : "{key: someKey}";
				didWarnAboutKeySpread[children + isStaticChildren] || (keys = 0 < keys.length ? "{" + keys.join(": ..., ") + ": ...}" : "{}", console.error("A props object containing a \"key\" prop is being spread into JSX:\n  let props = %s;\n  <%s {...props} />\nReact keys must be passed directly to JSX without using spread:\n  let props = %s;\n  <%s key={someKey} {...props} />", isStaticChildren, children, keys, children), didWarnAboutKeySpread[children + isStaticChildren] = !0);
			}
			children = null;
			void 0 !== maybeKey && (checkKeyStringCoercion(maybeKey), children = "" + maybeKey);
			hasValidKey(config) && (checkKeyStringCoercion(config.key), children = "" + config.key);
			if ("key" in config) {
				maybeKey = {};
				for (var propName in config) "key" !== propName && (maybeKey[propName] = config[propName]);
			} else maybeKey = config;
			children && defineKeyPropWarningGetter(maybeKey, "function" === typeof type ? type.displayName || type.name || "Unknown" : type);
			return ReactElement(type, children, maybeKey, getOwner(), debugStack, debugTask);
		}
		function validateChildKeys(node) {
			isValidElement(node) ? node._store && (node._store.validated = 1) : "object" === typeof node && null !== node && node.$$typeof === REACT_LAZY_TYPE && ("fulfilled" === node._payload.status ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
		}
		function isValidElement(object) {
			return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
		}
		var React = require_react(), REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference"), ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, hasOwnProperty = Object.prototype.hasOwnProperty, isArrayImpl = Array.isArray, createTask = console.createTask ? console.createTask : function() {
			return null;
		};
		React = { react_stack_bottom_frame: function(callStackForError) {
			return callStackForError();
		} };
		var specialPropKeyWarningShown;
		var didWarnAboutElementRef = {};
		var unknownOwnerDebugStack = React.react_stack_bottom_frame.bind(React, UnknownOwner)();
		var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
		var didWarnAboutKeySpread = {};
		exports.Fragment = REACT_FRAGMENT_TYPE;
		exports.jsx = function(type, config, maybeKey) {
			var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
			return jsxDEVImpl(type, config, maybeKey, !1, trackActualOwner ? Error("react-stack-top-frame") : unknownOwnerDebugStack, trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask);
		};
		exports.jsxs = function(type, config, maybeKey) {
			var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
			return jsxDEVImpl(type, config, maybeKey, !0, trackActualOwner ? Error("react-stack-top-frame") : unknownOwnerDebugStack, trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask);
		};
	})();
}));
//#endregion
//#region node_modules/react/jsx-runtime.js
var require_jsx_runtime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_react_jsx_runtime_development();
}));
//#endregion
//#region node_modules/@trustwallet/connect-core/dist/utils/storage.js
var Storage = class {
	isAvailable() {
		try {
			return typeof window !== "undefined" && window.localStorage !== void 0;
		} catch {
			return false;
		}
	}
	constructor({ key, version }) {
		this.key = `${key}.${version}`;
	}
	set(value) {
		if (!this.isAvailable()) return;
		try {
			const serialized = JSON.stringify(value);
			localStorage.setItem(this.key, serialized);
		} catch (error) {
			console.warn(`Failed to save to storage [${this.key}]:`, error);
		}
	}
	get() {
		if (!this.isAvailable()) return null;
		try {
			const item = localStorage.getItem(this.key);
			if (item === null) return null;
			return JSON.parse(item);
		} catch (error) {
			console.warn(`Failed to load from storage [${this.key}]:`, error);
			return null;
		}
	}
	remove() {
		if (!this.isAvailable()) return;
		try {
			localStorage.removeItem(this.key);
		} catch (error) {
			console.warn(`Failed to remove from storage [${this.key}]:`, error);
		}
	}
};
//#endregion
//#region node_modules/@trustwallet/connect-core/dist/utils/emitter.js
var Emitter = class {
	constructor() {
		this.listeners = /* @__PURE__ */ new Map();
	}
	on(event, handler) {
		let set = this.listeners.get(event);
		if (!set) {
			set = /* @__PURE__ */ new Set();
			this.listeners.set(event, set);
		}
		set.add(handler);
		return () => this.off(event, handler);
	}
	off(event, handler) {
		const set = this.listeners.get(event);
		if (!set) return;
		set.delete(handler);
		if (set.size === 0) this.listeners.delete(event);
	}
	emit(event, payload) {
		const set = this.listeners.get(event);
		if (!set) return;
		for (const handler of [...set]) try {
			handler(payload);
		} catch (error) {
			console.error(error);
		}
	}
	clear(event) {
		if (event) this.listeners.delete(event);
		else this.listeners.clear();
	}
};
//#endregion
//#region node_modules/@trustwallet/connect-core/dist/errors/base.js
var BaseError = class extends Error {
	constructor(message, code, context) {
		super(message);
		this.name = "TrustConnectError";
		this.code = code;
		this.context = context ?? {};
	}
};
//#endregion
//#region node_modules/@trustwallet/connect-core/dist/errors/connection.js
var NoActiveSessionError = class extends BaseError {
	constructor() {
		super("No active session", "NO_ACTIVE_SESSION");
		this.name = "NoActiveSessionError";
	}
};
var ConnectionInProgressError = class extends BaseError {
	constructor() {
		super("Connection already in progress", "CONNECTION_IN_PROGRESS");
		this.name = "ConnectionInProgressError";
	}
};
var WalletAlreadyConnectedError = class extends BaseError {
	constructor(walletId) {
		super(`Wallet already connected: ${walletId}`, "WALLET_ALREADY_CONNECTED", { walletId });
		this.name = "WalletAlreadyConnectedError";
	}
};
var NoWalletConnectedError = class extends BaseError {
	constructor(namespace) {
		const message = namespace ? `No wallet connected. Please connect a ${namespace} wallet first.` : "No wallet connected. Please connect a wallet first.";
		super(message, "NO_WALLET_CONNECTED", { namespace });
		this.name = "NoWalletConnectedError";
	}
};
//#endregion
//#region node_modules/@trustwallet/connect-core/dist/errors/notFound.js
var NamespaceNotFoundError = class extends BaseError {
	constructor(namespaceId) {
		super(`Namespace not found: ${namespaceId}`, "NAMESPACE_NOT_FOUND", { namespaceId });
		this.name = "NamespaceNotFoundError";
	}
};
//#endregion
//#region node_modules/@trustwallet/connect-core/dist/errors/config.js
var MissingChainError = class extends BaseError {
	constructor(namespace) {
		super(`No chain provided for ${namespace}`, "MISSING_CHAIN", { namespace });
		this.name = "MissingChainError";
	}
};
var MissingNamespaceIdError = class extends BaseError {
	constructor(walletId, walletType) {
		super(`Wallet must have a namespaceId`, "MISSING_NAMESPACE_ID", {
			walletId,
			walletType
		});
		this.name = "MissingNamespaceIdError";
	}
};
//#endregion
//#region node_modules/@trustwallet/connect-core/dist/utils/stringToWalletId.js
function stringToWalletId(value) {
	return value.toLowerCase().split(/\s+/)[0];
}
//#endregion
//#region node_modules/@trustwallet/connect-core/dist/00-trust-connect/base.js
var TrustConnectBase = class {
	constructor() {
		this.isLoading = false;
		this.error = null;
		this.events = new Emitter();
	}
	getConnectionAborted() {
		return this.connectionAborted;
	}
	getWallets() {
		return this.wallets;
	}
	getWallet(id) {
		return this.wallets.find((wallet) => wallet.id === id || stringToWalletId(wallet.name) === id);
	}
	getConnections() {
		return this.connections;
	}
	getNamespaces() {
		return this.namespaces;
	}
	getServices() {
		return this.services;
	}
	getIsLoading() {
		return this.isLoading;
	}
	getError() {
		return this.error;
	}
	setIsLoading(isLoading) {
		this.isLoading = isLoading;
		this.events.emit("isLoading", this.isLoading);
	}
	setError(error) {
		this.error = error;
		this.events.emit("error", this.error);
	}
	setConnectionAborted(isAborted) {
		this.connectionAborted = isAborted;
		return this.events.emit("connectionAborted", this.connectionAborted);
	}
	onWallets(cb) {
		return this.events.on("wallets", cb);
	}
	onConnections(cb) {
		return this.events.on("connections", cb);
	}
	onConnectionAborted(cb) {
		return this.events.on("connectionAborted", cb);
	}
	onIsLoading(cb) {
		return this.events.on("isLoading", cb);
	}
	onError(cb) {
		return this.events.on("error", cb);
	}
	onConnection(id, cb) {
		const namespace = this.namespaces.find((ns) => ns.id === id);
		if (!namespace) throw new NamespaceNotFoundError(id);
		return namespace.onConnection(cb);
	}
	getNamespace(id) {
		return this.namespaces.find((ns) => ns.id === id);
	}
	setConnection(namespace, state) {
		this.connections = {
			...this.connections,
			[namespace]: state
		};
		this.events.emit("connections", this.connections);
	}
	updateWallet(id, updater) {
		this.wallets = this.wallets.map((wallet) => wallet.id === id || stringToWalletId(wallet.name) === id ? updater(wallet) : wallet);
		this.events.emit("wallets", this.wallets);
	}
	addWallets(wallets) {
		this.wallets = [...this.wallets, ...wallets];
		this.events.emit("wallets", this.wallets);
	}
	clearAllListeners() {
		this.namespaces.forEach((namespace) => namespace.clearAllListeners());
		this.events.clear();
	}
};
//#endregion
//#region node_modules/@trustwallet/connect-core/dist/constants/caip.js
var CAIP = {
	ID: "caip",
	EVENTS: {
		SESSION_EVENT: "session_event",
		SESSION_DELETE: "session_delete"
	},
	NAMESPACES: { EVENTS: {
		ADDRESS_CHANGED: ["accountChanged", "accountsChanged"],
		CHAIN_REFERENCE_CHANGED: ["chainChanged"]
	} }
};
//#endregion
//#region node_modules/@trustwallet/connect-core/dist/01-caip/base.js
var STORAGE_KEY_PREFIX = "trust-connect.caip";
var CaipControllerBase = class {
	constructor() {
		this.lastConnectedWalletId = new Storage({
			key: `${STORAGE_KEY_PREFIX}.lastWallet`,
			version: "0.0.0"
		});
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
//#region node_modules/@trustwallet/connect-core/dist/utils/caip.js
function extractChainRef(chain) {
	const strChain = chain.toString();
	if (!strChain.includes(":")) return chain;
	const [_, reference] = strChain.split(":");
	return reference;
}
function extractAddress(accountId) {
	if (!accountId.includes(":")) return accountId;
	const parts = accountId.split(":");
	return parts[parts.length - 1];
}
function extractNamespace(chain) {
	if (!chain.includes(":")) return chain;
	const [namespace, _] = chain.split(":");
	return namespace;
}
function buildChainId({ namespace, reference }) {
	return `${namespace}:${reference}`;
}
//#endregion
//#region node_modules/@trustwallet/connect-core/dist/01-caip/controller.js
var CaipController = class extends CaipControllerBase {
	constructor({ namespaces, caipWallets }) {
		super();
		this.namespaces = /* @__PURE__ */ new Map();
		for (let namespace of namespaces) this.namespaces.set(namespace.id, namespace);
		this.wallets = caipWallets || [];
		this.start();
	}
	start() {
		const lastWalletId = this.getLastConnectedWalletId();
		if (!lastWalletId) return;
		for (let wallet of this.wallets) {
			if (wallet.id !== lastWalletId) continue;
			this.reconnect({ wallet });
		}
	}
	async reconnect({ wallet }) {
		this.startListeners(wallet);
		let session;
		try {
			session = await wallet.__internal.reconnect();
		} catch {} finally {
			if (!session) {
				wallet.__internal.clearAllListeners();
				this.clearLastConnectedWalletId();
				return;
			}
		}
		this.setConnections({
			session,
			wallet
		});
	}
	async connect(wallet) {
		this.startListeners(wallet);
		let session;
		try {
			session = await wallet.__internal.connect();
			if (!session) throw new NoActiveSessionError();
		} catch (e) {
			wallet.__internal.clearAllListeners();
			throw e;
		}
		this.setConnections({
			session,
			wallet
		});
	}
	disconnect() {
		for (let namespace of this.namespaces.values()) {
			const connection = namespace.getConnection();
			if (connection.status !== "connected") continue;
			connection.wallet.__internal.clearAllListeners();
			this.clearLastConnectedWalletId();
			namespace.setConnection({
				status: "disconnected",
				wallet: void 0,
				address: void 0,
				chain: void 0
			});
			connection.wallet.__internal.disconnect();
		}
	}
	abortConnect() {
		for (let wallet of this.wallets) {
			wallet.__internal.abortConnect();
			wallet.__internal.clearAllListeners();
		}
		for (let namespace of this.namespaces.values()) {
			const connection = namespace.getConnection();
			if (connection.status === "connecting" && connection.wallet) {
				connection.wallet.__internal.abortConnect();
				connection.wallet.__internal.clearAllListeners();
				this.clearLastConnectedWalletId();
				namespace.setConnection({
					status: "disconnected",
					wallet: void 0,
					address: void 0,
					chain: void 0
				});
			}
		}
	}
	onSessionEvent(caipSessionEvent) {
		const { chainId, event } = caipSessionEvent;
		const namespaceId = extractNamespace(chainId);
		const connection = this.namespaces.get(namespaceId)?.getConnection();
		if (!connection || connection.status !== "connected") return;
		if (CAIP.NAMESPACES.EVENTS.ADDRESS_CHANGED.includes(event.name)) {
			const accounts = event.data;
			connection.wallet.__internal.setAddress(accounts[0]);
		} else if (CAIP.NAMESPACES.EVENTS.CHAIN_REFERENCE_CHANGED.includes(event.name)) {
			const reference = extractChainRef(event.data);
			connection.wallet.__internal.setChain({
				namespace: namespaceId,
				reference
			});
		}
	}
	setConnections({ session, wallet }) {
		let isConnected = false;
		for (let [namespaceId, scope] of Object.entries(session.namespaces)) {
			const firstAccount = scope.accounts[0];
			const firstChain = scope.chains[0];
			if (!firstAccount) {
				console.error(`Wallet ${wallet.id} was unable to connect with namespace ${namespaceId}`);
				continue;
			}
			const address = extractAddress(firstAccount);
			const chainRef = extractChainRef(firstChain);
			const namespace = this.namespaces.get(namespaceId);
			if (!namespace) {
				console.error(`Namespace ${namespaceId} not found`);
				continue;
			}
			isConnected = true;
			namespace.setConnection({
				status: "connected",
				wallet,
				address,
				/**
				* Chains in CAIP for connections are irrelevant since there is no single active chain.
				* In the CAIP paradigm all chains are active at the same time.
				*/
				chain: {
					namespace: namespace.id,
					reference: chainRef
				}
			});
		}
		if (isConnected) this.saveLastConnectedWalletId(wallet.id);
		else this.disconnect();
	}
	startListeners(wallet) {
		wallet.__internal.clearAllListeners();
		wallet.__internal.handleOnCaipSessionEvent(this.onSessionEvent.bind(this));
		wallet.__internal.handleOnCaipSessionDelete(this.disconnect.bind(this));
		wallet.__internal.startListeners();
	}
};
//#endregion
//#region node_modules/@trustwallet/connect-core/dist/00-trust-connect/engine.js
var TrustConnect = class extends TrustConnectBase {
	constructor(options) {
		super();
		this.wallets = [];
		this.connections = {};
		this.namespaces = [];
		this.services = [];
		this.connectionAborted = false;
		/** create namespaces and services */
		const caipWallets = [];
		const scopes = /* @__PURE__ */ new Map();
		this.namespaces = options.namespaces.map((external) => {
			const { namespace, scope } = external.__createNamespace();
			scopes.set(namespace.id, scope);
			return namespace;
		});
		this.services = options.services?.map((external) => {
			const service = external.__createService({ scopes });
			if (service.caipWallet) caipWallets.push(service.caipWallet);
			return service;
		}) || [];
		this.caipController = new CaipController({
			namespaces: this.namespaces,
			caipWallets
		});
		this.start();
	}
	start() {
		for (let namespace of this.namespaces) {
			const namespaceId = namespace.id;
			const wallets = namespace.getWallets();
			this.computeNamespaceWallet({
				namespaceId,
				wallets
			});
			const connection = namespace.getConnection();
			this.setConnection(namespaceId, connection);
			namespace.onWallets((wallets) => {
				this.computeNamespaceWallet({
					namespaceId,
					wallets
				});
			});
			namespace.onConnection((next) => {
				this.setConnection(namespaceId, next);
			});
		}
	}
	/**
	* Connect a caip wallet or a wallet to a specific namespace.
	*/
	async connect({ wallet }) {
		try {
			this.setConnectionAborted(false);
			this.setIsLoading(true);
			this.setError(null);
			if (wallet.type === "caip") return await this.caipController.connect(wallet);
			if (!wallet.namespaceIds.length) throw new MissingNamespaceIdError(wallet.id, wallet.type);
			const namespace = this.getNamespace(wallet.namespaceIds[0]);
			if (!namespace) throw new NamespaceNotFoundError(wallet.namespaceIds[0]);
			return await namespace.connect(wallet);
		} catch (error) {
			const err = error instanceof Error ? error : new Error(typeof error === "object" && error !== null && "message" in error ? String(error.message) : JSON.stringify(error));
			this.setError(err);
			throw err;
		} finally {
			this.setIsLoading(false);
		}
	}
	/**
	* Disconnect from one or all namespaces.
	*/
	disconnect({ namespaceId } = {}) {
		try {
			if (namespaceId) {
				this.getNamespace(namespaceId)?.disconnect();
				return;
			}
			const connectionValues = Object.values(this.connections);
			for (let connection of connectionValues) if (connection.wallet?.type === "caip") this.caipController.disconnect();
			else for (let namespace of this.namespaces) namespace.disconnect();
		} catch (error) {
			if ("message" in error) console.error(error.message);
		}
	}
	/**
	* Abort any pending connection attempts
	* Does not throw errors, simply cleans up connection attempts and listeners
	*/
	abortConnect({ namespaceId } = {}) {
		this.setConnectionAborted(true);
		this.setIsLoading(false);
		this.setError(null);
		if (namespaceId) {
			const namespace = this.getNamespace(namespaceId);
			if (namespace) namespace.abortConnect();
			return;
		}
		for (const namespace of this.namespaces) namespace.abortConnect();
		this.caipController.abortConnect();
	}
	/**
	* Clear any error state
	*/
	clearError() {
		this.setError(null);
	}
	/**
	* We take each wallet from each namespace object
	* and merged all together into Wallet type and store them.
	* */
	computeNamespaceWallet({ namespaceId, wallets }) {
		const walletsToSet = [];
		for (const wallet of wallets) {
			/**
			* since there is no unified protocol in use by most multi-chain wallets
			* a wallet may use different IDs in each network provider. This is a workaround
			* to the lack of unification protocol.
			*/
			let isNameId = false;
			const nameId = stringToWalletId(wallet.name);
			let existingWallet;
			existingWallet = this.getWallet(wallet.id);
			if (!existingWallet) {
				existingWallet = this.getWallet(nameId);
				isNameId = Boolean(existingWallet);
			}
			if (existingWallet) {
				wallet.id = existingWallet.id;
				this.updateWallet(isNameId ? nameId : wallet.id, (existingWallet) => ({
					...existingWallet,
					namespaceIds: new Set([...existingWallet.namespaceIds, ...wallet.namespaceIds]),
					namespaces: {
						...existingWallet.namespaces,
						[namespaceId]: wallet
					}
				}));
			} else walletsToSet.push({
				id: wallet.id,
				name: wallet.name,
				type: wallet.type,
				icon: wallet.icon,
				namespaceIds: new Set([namespaceId]),
				namespaces: { [namespaceId]: wallet }
			});
		}
		if (walletsToSet.length > 0) this.addWallets(walletsToSet);
	}
};
//#endregion
//#region node_modules/@trustwallet/connect-headless/dist/errors.js
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var ReactContextError = class extends BaseError {
	constructor(hookName, providerName) {
		super(`${hookName} must be used within ${providerName}`, "REACT_CONTEXT_ERROR", {
			hookName,
			providerName
		});
		this.name = "ReactContextError";
	}
};
var MissingRequiredParamError = class extends BaseError {
	constructor(paramName, context) {
		const message = context ? `${paramName} is required. ${context}` : `${paramName} is required`;
		super(message, "MISSING_REQUIRED_PARAM", {
			paramName,
			context
		});
		this.name = "MissingRequiredParamError";
	}
};
//#endregion
//#region node_modules/@trustwallet/connect-headless/dist/context.js
var TrustConnectContext = (0, import_react.createContext)(null);
function TrustConnectProvider({ children, config }) {
	const [client] = (0, import_react.useState)(() => new TrustConnect(config));
	return (0, import_jsx_runtime.jsx)(TrustConnectContext.Provider, {
		value: { client },
		children
	});
}
function useTrustConnectContext() {
	const context = (0, import_react.useContext)(TrustConnectContext);
	if (!context) throw new ReactContextError("useTrustConnectContext", "TrustConnectProvider");
	return context;
}
//#endregion
//#region node_modules/@trustwallet/connect-headless/dist/hooks/useConnection.js
/**
* Get a single active connection from TrustConnect.
* Returns a typed connection and derived connection flags for the namespace.
*/
function useConnection(options) {
	const { namespaceId } = options;
	const { client } = useTrustConnectContext();
	const namespace = (0, import_react.useMemo)(() => {
		const namespace = client.getNamespace(namespaceId);
		if (!namespace) throw new NamespaceNotFoundError(namespaceId);
		return namespace;
	}, [namespaceId, client]);
	const connection = (0, import_react.useSyncExternalStore)((callback) => namespace.onConnection(callback), () => namespace.getConnection(), () => namespace.getConnection());
	return {
		connection,
		isConnected: connection.status === "connected",
		isConnecting: connection.status === "connecting",
		address: connection.address,
		chain: connection.chain,
		wallet: connection.wallet,
		status: connection.status
	};
}
//#endregion
export { ReactContextError as a, NamespaceNotFoundError as c, WalletAlreadyConnectedError as d, BaseError as f, require_jsx_runtime as h, MissingRequiredParamError as i, ConnectionInProgressError as l, Storage as m, TrustConnectProvider as n, buildChainId as o, Emitter as p, useTrustConnectContext as r, MissingChainError as s, useConnection as t, NoWalletConnectedError as u };

//# sourceMappingURL=useConnection-CYhZ-aoN.js.map