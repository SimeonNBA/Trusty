import { r as __toESM, t as require_react } from "./react-CoTh1R2n.js";
import { a as ReactContextError, c as NamespaceNotFoundError, f as BaseError, h as require_jsx_runtime, i as MissingRequiredParamError, n as TrustConnectProvider$1, r as useTrustConnectContext, t as useConnection } from "./useConnection-CYhZ-aoN.js";
import { t as require_react_dom } from "./react-dom-DWSBsIl4.js";
import "D:/Trusty-AI/frontend/swap-app/node_modules/@trustwallet/connect-react/dist/global-NUJAOJRO.css";
import styles from "D:/Trusty-AI/frontend/swap-app/node_modules/@trustwallet/connect-react/dist/styles.module-IZSJLNB4.module.css";
import styles2 from "D:/Trusty-AI/frontend/swap-app/node_modules/@trustwallet/connect-react/dist/styles.module-GCRMKZIZ.module.css";
import styles3 from "D:/Trusty-AI/frontend/swap-app/node_modules/@trustwallet/connect-react/dist/styles.module-5L4UXGVZ.module.css";
import styles4 from "D:/Trusty-AI/frontend/swap-app/node_modules/@trustwallet/connect-react/dist/styles.module-HR3VQZUH.module.css";
import styles6 from "D:/Trusty-AI/frontend/swap-app/node_modules/@trustwallet/connect-react/dist/styles.module-FMH4FUT5.module.css";
import styles5 from "D:/Trusty-AI/frontend/swap-app/node_modules/@trustwallet/connect-react/dist/styles.module-U5TRY5PT.module.css";
import styles7 from "D:/Trusty-AI/frontend/swap-app/node_modules/@trustwallet/connect-react/dist/styles.module-RKS6GYHN.module.css";
import styles8 from "D:/Trusty-AI/frontend/swap-app/node_modules/@trustwallet/connect-react/dist/styles.module-NDDQJHO2.module.css";
import styles9 from "D:/Trusty-AI/frontend/swap-app/node_modules/@trustwallet/connect-react/dist/styles.module-JFMC6A5G.module.css";
import styles10 from "D:/Trusty-AI/frontend/swap-app/node_modules/@trustwallet/connect-react/dist/styles.module-VWMJAIVE.module.css";
import styles11 from "D:/Trusty-AI/frontend/swap-app/node_modules/@trustwallet/connect-react/dist/styles.module-5FM5SDSC.module.css";
import styles12 from "D:/Trusty-AI/frontend/swap-app/node_modules/@trustwallet/connect-react/dist/styles.module-Y3MUWEOL.module.css";
import styles13 from "D:/Trusty-AI/frontend/swap-app/node_modules/@trustwallet/connect-react/dist/styles.module-WGWNXHEK.module.css";
import styles14 from "D:/Trusty-AI/frontend/swap-app/node_modules/@trustwallet/connect-react/dist/styles.module-27BC6Q35.module.css";
import styles15 from "D:/Trusty-AI/frontend/swap-app/node_modules/@trustwallet/connect-react/dist/styles.module-5S7A3MI3.module.css";
import styles16 from "D:/Trusty-AI/frontend/swap-app/node_modules/@trustwallet/connect-react/dist/styles.module-KIOD6JAJ.module.css";
import styles17 from "D:/Trusty-AI/frontend/swap-app/node_modules/@trustwallet/connect-react/dist/styles.module-U6N4VKTA.module.css";
import styles18 from "D:/Trusty-AI/frontend/swap-app/node_modules/@trustwallet/connect-react/dist/styles.module-4I5UVTXZ.module.css";
import styles20 from "D:/Trusty-AI/frontend/swap-app/node_modules/@trustwallet/connect-react/dist/styles.module-BH6BB6HX.module.css";
import styles21 from "D:/Trusty-AI/frontend/swap-app/node_modules/@trustwallet/connect-react/dist/styles.module-PXUDS327.module.css";
import styles22 from "D:/Trusty-AI/frontend/swap-app/node_modules/@trustwallet/connect-react/dist/styles.module-ZPYBUUD6.module.css";
import styles23 from "D:/Trusty-AI/frontend/swap-app/node_modules/@trustwallet/connect-react/dist/styles.module-YJSZIZTZ.module.css";
import styles24 from "D:/Trusty-AI/frontend/swap-app/node_modules/@trustwallet/connect-react/dist/styles.module-5TDOAM3X.module.css";
import styles25 from "D:/Trusty-AI/frontend/swap-app/node_modules/@trustwallet/connect-react/dist/styles.module-2IXPYHX5.module.css";
import styles26 from "D:/Trusty-AI/frontend/swap-app/node_modules/@trustwallet/connect-react/dist/styles.module-5C4YIUDE.module.css";
import styles27 from "D:/Trusty-AI/frontend/swap-app/node_modules/@trustwallet/connect-react/dist/styles.module-GSNHG7ET.module.css";
import styles28 from "D:/Trusty-AI/frontend/swap-app/node_modules/@trustwallet/connect-react/dist/styles.module-ZISFY5AO.module.css";
import styles29 from "D:/Trusty-AI/frontend/swap-app/node_modules/@trustwallet/connect-react/dist/styles.module-4QHLSLTJ.module.css";
//#region node_modules/@trustwallet/connect-headless/dist/hooks/useWalletsByNamespace.js
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
/**
* Get all wallets from TrustConnect registry.
*/
function useWalletsByNamespace(namespaceId) {
	const { client } = useTrustConnectContext();
	const namespace = (0, import_react.useMemo)(() => {
		/** if the id is not provided we mock the namespace */
		if (!namespaceId) {
			const emptyArray = [];
			return {
				onWallets() {
					return () => emptyArray;
				},
				getWallets: () => emptyArray
			};
		}
		return client.getNamespace(namespaceId);
	}, [namespaceId]);
	if (!namespace) throw new NamespaceNotFoundError(namespaceId);
	return (0, import_react.useSyncExternalStore)((callback) => namespace.onWallets(callback), () => namespace.getWallets(), () => namespace.getWallets());
}
//#endregion
//#region node_modules/@trustwallet/connect-headless/dist/hooks/useWallets.js
/**
* Get all wallets from TrustConnect registry.
*/
function useWallets({ namespaceId } = {}) {
	const { client } = useTrustConnectContext();
	const walletAdapters = useWalletsByNamespace(namespaceId);
	const globalWallets = (0, import_react.useSyncExternalStore)((callback) => client.onWallets(callback), () => client.getWallets(), () => client.getWallets());
	return { wallets: namespaceId ? walletAdapters : globalWallets };
}
//#endregion
//#region node_modules/@trustwallet/connect-headless/dist/hooks/useConnections.js
/**
* Get all active connections from TrustConnect.
* Returns a partial object with connections indexed by namespace ID.
* When namespaceId is provided, the connection type is properly inferred.
*/
function useConnections() {
	const { client } = useTrustConnectContext();
	return { connections: (0, import_react.useSyncExternalStore)((callback) => client.onConnections(callback), () => client.getConnections(), () => client.getConnections()) };
}
//#endregion
//#region node_modules/@trustwallet/connect-headless/dist/hooks/useConnect.js
/**
* Main hook for managing wallet connections in TrustConnect.
* Provides wallet management, connection handling, and loading/error states.
* @returns an object containing:
* - connect: function to connect a wallet adapter
* - error: any error that occurred during connection
* - isLoading: boolean indicating if a connection is in progress
* - wallets: array of all available wallets
*/
function useConnect({ namespaceId } = {}) {
	const { client } = useTrustConnectContext();
	const error = (0, import_react.useSyncExternalStore)((callback) => client.onError(callback), () => client.getError(), () => client.getError());
	const isLoading = (0, import_react.useSyncExternalStore)((callback) => client.onIsLoading(callback), () => client.getIsLoading(), () => client.getIsLoading());
	const globalWallets = useWallets();
	const walletAdapters = useWalletsByNamespace(namespaceId);
	return {
		connect: (0, import_react.useCallback)(async ({ wallet }) => {
			await client.connect({ wallet });
		}, []),
		disconnect: (0, import_react.useCallback)(({ namespaceId } = {}) => {
			client.disconnect({ namespaceId });
		}, []),
		abortConnect: (0, import_react.useCallback)(({ namespaceId } = {}) => {
			client.abortConnect({ namespaceId });
		}, []),
		isConnectionAborted: (0, import_react.useSyncExternalStore)((callback) => client.onConnectionAborted(callback), () => client.getConnectionAborted(), () => client.getConnectionAborted()),
		clearError: (0, import_react.useCallback)(() => {
			client.clearError();
		}, []),
		error,
		isLoading,
		wallets: namespaceId ? walletAdapters : globalWallets
	};
}
//#endregion
//#region node_modules/@trustwallet/connect-headless/dist/hooks/useNamespaces.js
function useNamespaces() {
	const { client } = useTrustConnectContext();
	return { namespaces: (0, import_react.useMemo)(() => client.getNamespaces(), [client]) };
}
//#endregion
//#region node_modules/@trustwallet/connect-headless/dist/hooks/useWalletIds.js
function useWalletIds({ namespaceId } = {}) {
	const { connections } = useConnections();
	return (0, import_react.useMemo)(() => {
		const connectedWalletIds = [];
		const connectingWalletIds = [];
		if (namespaceId) {
			const connection = connections[namespaceId];
			if (connection?.wallet?.id) {
				if (connection.status === "connected") connectedWalletIds.push(connection.wallet.id);
				else if (connection.status === "connecting") connectingWalletIds.push(connection.wallet.id);
			}
		} else for (const connection of Object.values(connections)) {
			const castedCon = connection;
			if (castedCon?.wallet?.id) {
				if (castedCon.status === "connected") connectedWalletIds.push(castedCon.wallet.id);
				else if (castedCon.status === "connecting") connectingWalletIds.push(castedCon.wallet.id);
			}
		}
		return {
			connectedWalletIds,
			connectingWalletIds
		};
	}, [connections, namespaceId]);
}
//#endregion
//#region node_modules/@trustwallet/connect-ui-logic/dist/hooks/useTheme.js
var THEME_STORAGE_KEY = "trust-connect-theme";
var THEME_ATTRIBUTE = "data-tcui-theme";
function getSystemTheme() {
	if (typeof window === "undefined") return "light";
	return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function getStoredTheme() {
	if (typeof window === "undefined") return "auto";
	try {
		const stored = localStorage.getItem(THEME_STORAGE_KEY);
		if (stored === "light" || stored === "dark" || stored === "auto") return stored;
	} catch {}
	return "auto";
}
var systemThemeStore = (() => {
	let listeners = [];
	let mediaQuery = null;
	const subscribe = (callback) => {
		listeners.push(callback);
		if (typeof window !== "undefined" && !mediaQuery) {
			mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
			const handler = () => {
				listeners.forEach((listener) => listener());
			};
			if (mediaQuery.addEventListener) mediaQuery.addEventListener("change", handler);
			else mediaQuery.addListener(handler);
		}
		return () => {
			listeners = listeners.filter((l) => l !== callback);
		};
	};
	const getSnapshot = () => getSystemTheme();
	const getServerSnapshot = () => "light";
	return {
		subscribe,
		getSnapshot,
		getServerSnapshot
	};
})();
function useTheme(defaultTheme) {
	const [theme, setThemeState] = (0, import_react.useState)(() => defaultTheme ?? getStoredTheme());
	const systemTheme = (0, import_react.useSyncExternalStore)(systemThemeStore.subscribe, systemThemeStore.getSnapshot, systemThemeStore.getServerSnapshot);
	const resolvedTheme = (0, import_react.useMemo)(() => {
		if (theme === "auto") return systemTheme;
		return theme;
	}, [theme, systemTheme]);
	(0, import_react.useEffect)(() => {
		if (typeof document !== "undefined") document.documentElement.setAttribute(THEME_ATTRIBUTE, resolvedTheme);
	}, [resolvedTheme]);
	const setTheme = (0, import_react.useCallback)((newTheme) => {
		setThemeState(newTheme);
		try {
			localStorage.setItem(THEME_STORAGE_KEY, newTheme);
		} catch {}
	}, []);
	return {
		theme,
		resolvedTheme,
		setTheme,
		toggleTheme: (0, import_react.useCallback)(() => {
			setTheme(resolvedTheme === "dark" ? "light" : "dark");
		}, [resolvedTheme, setTheme])
	};
}
//#endregion
//#region node_modules/@trustwallet/connect-ui-logic/dist/context/TrustModalContext.js
var import_jsx_runtime = require_jsx_runtime();
var TrustModalContext = (0, import_react.createContext)(null);
function TrustModalProvider({ children, theme: initialTheme }) {
	const [isOpen, setIsOpen] = (0, import_react.useState)(false);
	const [view, setViewState] = (0, import_react.useState)("wallets");
	const [modalType, setModalType] = (0, import_react.useState)("wallet");
	const historyRef = (0, import_react.useRef)([]);
	const [namespaceFilter, setNamespaceFilter] = (0, import_react.useState)(void 0);
	const [targetWallet, setTargetWallet] = (0, import_react.useState)(null);
	const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme(initialTheme);
	const { clearError, abortConnect, isLoading } = useConnect();
	const { namespaces } = useNamespaces();
	(0, import_react.useEffect)(() => {
		if (namespaces.length === 1) setModalType("namespace");
	}, [namespaces]);
	const setView = (0, import_react.useCallback)((nextView) => {
		historyRef.current.push(view);
		setViewState(nextView);
	}, [view]);
	const goBack = (0, import_react.useCallback)(() => {
		clearError();
		if (isLoading) abortConnect();
		setViewState(historyRef.current.pop() ?? (modalType === "wallet" ? "wallets" : "networks"));
	}, [
		clearError,
		abortConnect,
		modalType,
		isLoading
	]);
	const open = (0, import_react.useCallback)((options = {}) => {
		setModalType(options.type || "wallet");
		setIsOpen(true);
		historyRef.current = [];
		setNamespaceFilter(options.namespaceId);
		setTargetWallet(null);
	}, []);
	const close = (0, import_react.useCallback)(() => {
		setIsOpen(false);
		setNamespaceFilter(void 0);
		setTargetWallet(null);
		historyRef.current = [];
		setViewState("wallets");
	}, []);
	const value = (0, import_react.useMemo)(() => ({
		isOpen,
		view,
		namespaceFilter,
		targetWallet,
		theme,
		resolvedTheme,
		modalType,
		open,
		close,
		setView,
		goBack,
		setNamespaceFilter,
		setTargetWallet,
		setTheme,
		toggleTheme
	}), [
		isOpen,
		view,
		namespaceFilter,
		targetWallet,
		theme,
		resolvedTheme,
		modalType,
		open,
		close,
		setView,
		goBack,
		setNamespaceFilter,
		setTargetWallet,
		setTheme,
		toggleTheme
	]);
	return (0, import_jsx_runtime.jsx)(TrustModalContext.Provider, {
		value,
		children
	});
}
function useTrustModal() {
	const context = (0, import_react.useContext)(TrustModalContext);
	if (!context) throw new ReactContextError("useTrustModal", "TrustModalProvider");
	return context;
}
//#endregion
//#region node_modules/@trustwallet/connect-ui-logic/dist/hooks/useCopyToClipboard.js
function useCopyToClipboard() {
	const [copied, setCopied] = (0, import_react.useState)(false);
	return {
		copied,
		copy: (0, import_react.useCallback)(async (text) => {
			try {
				await navigator.clipboard.writeText(text);
				setCopied(true);
				setTimeout(() => setCopied(false), 2e3);
				return true;
			} catch (err) {
				console.error("Unable to copy:", err);
				return false;
			}
		}, [])
	};
}
//#endregion
//#region node_modules/@trustwallet/connect-utils/dist/browser/detectMobile.js
/**
* Detects if the user is on a mobile device
* Checks user agent and touch support
*/
function isMobile() {
	if (typeof window === "undefined") return false;
	const userAgent = navigator.userAgent || navigator.vendor || window.opera;
	const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
	const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
	const isSmallScreen = window.innerWidth < 768;
	return isMobileUA || hasTouch && isSmallScreen;
}
/**
* Gets the current platform (iOS, Android, or desktop)
*/
function getPlatform() {
	if (typeof window === "undefined") return "desktop";
	const userAgent = navigator.userAgent || navigator.vendor || window.opera;
	if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) return "ios";
	if (/android/i.test(userAgent)) return "android";
	return "desktop";
}
//#endregion
//#region node_modules/@trustwallet/connect-utils/dist/constants/trust.js
var TRUST_WALLET = {
	ID: "trust",
	NAME: "Trust Wallet",
	INSTALL_LINK: "https://trustwallet.com/download",
	LOGO: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOTYiIGhlaWdodD0iOTYiIHZpZXdCb3g9IjAgMCA5NiA5NiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE2IDIxLjU2MjVMNDguNDk3NCAxMVY4NC4xMjA5QzI1LjI4NDcgNzQuMzcwNiAxNiA1NS42ODQzIDE2IDQ1LjEyNFYyMS41NjI1WiIgZmlsbD0iIzA1MDBGRiIvPgo8cGF0aCBkPSJNODAuOTk3NCAyMS41NjI1TDQ4LjUgMTFWODQuMTIwOUM3MS43MTI4IDc0LjM3MDYgODAuOTk3NCA1NS42ODQzIDgwLjk5NzQgNDUuMTI0VjIxLjU2MjVaIiBmaWxsPSJ1cmwoI3BhaW50MF9saW5lYXJfMTgyXzExMDE4KSIvPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJwYWludDBfbGluZWFyXzE4Ml8xMTAxOCIgeDE9IjcyLjM2NTIiIHkxPSI1Ljg3OTYiIHgyPSI0Ny44MTYxIiB5Mj0iODMuMTIyIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CjxzdG9wIG9mZnNldD0iMC4wMiIgc3RvcC1jb2xvcj0iIzAwMDBGRiIvPgo8c3RvcCBvZmZzZXQ9IjAuMDgiIHN0b3AtY29sb3I9IiMwMDk0RkYiLz4KPHN0b3Agb2Zmc2V0PSIwLjE2IiBzdG9wLWNvbG9yPSIjNDhGRjkxIi8+CjxzdG9wIG9mZnNldD0iMC40MiIgc3RvcC1jb2xvcj0iIzAwOTRGRiIvPgo8c3RvcCBvZmZzZXQ9IjAuNjgiIHN0b3AtY29sb3I9IiMwMDM4RkYiLz4KPHN0b3Agb2Zmc2V0PSIwLjkiIHN0b3AtY29sb3I9IiMwNTAwRkYiLz4KPC9saW5lYXJHcmFkaWVudD4KPC9kZWZzPgo8L3N2Zz4K"
};
//#endregion
//#region node_modules/@trustwallet/connect-ui-logic/dist/hooks/useAnimateTransition.js
function useAnimateTransition({ dependencyList }) {
	const bodyRef = (0, import_react.useRef)(null);
	const wrapperRef = (0, import_react.useRef)(null);
	const prevHeightRef = (0, import_react.useRef)(0);
	const isAnimating = (0, import_react.useRef)(false);
	(0, import_react.useEffect)(() => {
		const bodyElement = bodyRef.current;
		const wrapperElement = wrapperRef.current;
		if (!bodyElement || !wrapperElement) return;
		wrapperElement.style.overflow = "hidden";
		const headerHeight = wrapperElement.querySelector("header")?.clientHeight;
		const bodyHeight = bodyElement.clientHeight;
		const computedWrapper = window.getComputedStyle(wrapperElement);
		const paddingTop = Number.parseFloat(computedWrapper.paddingTop);
		const paddingBottom = Number.parseFloat(computedWrapper.paddingBottom);
		const borderTop = Number.parseFloat(computedWrapper.borderTopWidth);
		const borderBottom = Number.parseFloat(computedWrapper.borderBottomWidth);
		const extraHeight = paddingTop + paddingBottom + borderTop + borderBottom;
		const minHeight = Number.parseFloat(computedWrapper.minHeight) || 0;
		if (!prevHeightRef.current) {
			const calculatedHeight = bodyHeight + headerHeight + extraHeight;
			prevHeightRef.current = Math.max(calculatedHeight, minHeight);
		}
		isAnimating.current = false;
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const calculatedHeight = entry.borderBoxSize[0].blockSize + headerHeight + extraHeight;
				const newHeight = Math.max(calculatedHeight, minHeight);
				const prevHeight = prevHeightRef.current;
				if (Math.abs(prevHeight - newHeight) > 1 && !isAnimating.current) {
					isAnimating.current = true;
					wrapperElement.style.transition = "none";
					wrapperElement.style.height = `${prevHeight}px`;
					requestAnimationFrame(() => {
						wrapperElement.style.transition = "height 0.2s ease-out";
						wrapperElement.style.height = `${newHeight}px`;
						setTimeout(() => {
							wrapperElement.style.height = "auto";
						}, 301);
					});
					prevHeightRef.current = newHeight;
				}
			}
		});
		observer.observe(bodyElement);
		return () => {
			observer.disconnect();
			isAnimating.current = false;
			wrapperElement.style.transition = "none";
			wrapperElement.style.height = "auto";
		};
	}, dependencyList);
	return {
		bodyRef,
		wrapperRef
	};
}
//#endregion
//#region node_modules/@trustwallet/connect-ui-logic/dist/TrustModal/index.js
var import_react_dom = require_react_dom();
function TrustModalLogic({ layout, views, mobileViews }) {
	const { overlay: Overlay, wrapper: Wrapper, header: Header, body: Body, error: Error } = layout;
	const { isOpen, view, close, goBack, setNamespaceFilter, setTargetWallet, modalType } = useTrustModal();
	const [isMobileDevice] = (0, import_react.useState)(() => isMobile());
	const { abortConnect, error, isLoading } = useConnect();
	const { bodyRef, wrapperRef } = useAnimateTransition({ dependencyList: [view, isOpen] });
	const activeViews = isMobileDevice ? mobileViews : views;
	const headerTitle = activeViews.find((v) => v.tag === view)?.title;
	const showBack = view !== (modalType === "wallet" || isMobileDevice ? "wallets" : "networks") && modalType !== "namespace";
	(0, import_react.useEffect)(() => {
		const handler = (event) => {
			if (event.key === "Escape") close();
		};
		if (isOpen) window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [isOpen, close]);
	(0, import_react.useEffect)(() => {
		if (!isOpen) {
			setTargetWallet(null);
			setNamespaceFilter(void 0);
			if (isLoading) abortConnect();
		}
	}, [
		isOpen,
		abortConnect,
		setTargetWallet,
		setNamespaceFilter
	]);
	if (!isOpen) return null;
	return (0, import_react_dom.createPortal)((0, import_jsx_runtime.jsx)(Overlay, {
		onClick: close,
		children: (0, import_jsx_runtime.jsxs)(Wrapper, {
			onClick: (event) => event.stopPropagation(),
			wrapperRef,
			children: [(0, import_jsx_runtime.jsx)(Header, {
				title: headerTitle,
				showBack,
				onBack: goBack,
				onClose: close
			}), (0, import_jsx_runtime.jsxs)(Body, {
				bodyRef,
				children: [activeViews.map((viewConfig) => {
					if (view === viewConfig.tag) {
						const ViewComponent = viewConfig.node;
						return (0, import_jsx_runtime.jsx)(ViewComponent, {}, viewConfig.tag);
					}
					return null;
				}), !isMobileDevice && error && (0, import_jsx_runtime.jsx)(Error, { message: error.message })]
			})]
		})
	}), document.body);
}
//#endregion
//#region node_modules/@trustwallet/connect-ui-logic/dist/utils/handleConnectWallet.js
async function handleConnectWallet({ wallet, namespaceId, connect }) {
	if (wallet.type === "caip") {
		await connect({ wallet });
		return;
	}
	if (!namespaceId) {
		console.error("Select a namespace before connecting");
		return;
	}
	const namespaceWallet = wallet.namespaces[namespaceId];
	if (!namespaceWallet) {
		console.error(`Wallet ${wallet.id} does not support namespace ${namespaceId}`);
		return;
	}
	await connect({ wallet: namespaceWallet });
}
//#endregion
//#region node_modules/@trustwallet/connect-ui-logic/dist/views/WalletsView/WalletsViewLogic.js
function WalletsViewLogic({ components }) {
	const { emptyState: EmptyState, header: Header, grid: Grid, walletButton: WalletButton, walletConnectButton: WalletConnectButton } = components;
	const { wallets } = useWallets();
	const { connect, disconnect } = useConnect();
	const { connections } = useConnections();
	const { namespaces } = useNamespaces();
	const { modalType, namespaceFilter, setTargetWallet, setView } = useTrustModal();
	const { connectedWalletIds, connectingWalletIds } = useWalletIds({ namespaceId: namespaceFilter });
	const sortedWallets = (0, import_react.useMemo)(() => {
		return [...namespaceFilter ? wallets.filter((wallet) => {
			return Object.keys(wallet.namespaces).includes(namespaceFilter);
		}) : wallets].sort((a, b) => {
			if (a.id === TRUST_WALLET.ID) return -1;
			if (b.id === TRUST_WALLET.ID) return 1;
			return 0;
		});
	}, [wallets, namespaceFilter]);
	const namespaceIconsMap = (0, import_react.useMemo)(() => new Map(namespaces.map((ns) => [ns.id, ns.icon])), [namespaces]);
	const hasActiveConnection = (0, import_react.useMemo)(() => {
		if (!namespaceFilter) return null;
		return connections[namespaceFilter];
	}, [connections, namespaceFilter])?.status === "connected";
	const getSupportedNamespaceIcons = (wallet) => {
		if (modalType !== "wallet") return void 0;
		return Array.from(wallet.namespaceIds).map((nsId) => namespaceIconsMap.get(nsId)).filter(Boolean);
	};
	const getActionLabel = (isConnected) => {
		if (!isConnected) return "Connect";
		return modalType === "wallet" ? "Manage" : "Disconnect";
	};
	const isWalletDisabled = (wallet) => {
		return modalType === "namespace" && hasActiveConnection && !connectedWalletIds.includes(wallet.id);
	};
	const handleWalletClick = async (wallet) => {
		if (modalType === "wallet") {
			setTargetWallet(wallet);
			setView("networks");
			return;
		}
		if (modalType === "namespace") {
			if (!namespaceFilter) throw new MissingRequiredParamError("namespaceFilter");
			const connection = connections[namespaceFilter];
			if (connection && connection.status === "connected") {
				disconnect();
				return;
			}
			handleConnectWallet({
				wallet,
				namespaceId: namespaceFilter,
				connect
			});
		}
	};
	const namespaceNameFilter = (0, import_react.useMemo)(() => {
		if (namespaceFilter) return namespaces.find((n) => n.id === namespaceFilter)?.name || "";
		return "";
	}, [namespaceFilter]);
	if (sortedWallets.length === 0) return (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [(0, import_jsx_runtime.jsx)(EmptyState, { message: modalType === "namespace" ? `No ${namespaceNameFilter} wallets found.` : void 0 }), (0, import_jsx_runtime.jsx)(WalletConnectButton, {})] });
	return (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		namespaceFilter && (0, import_jsx_runtime.jsx)(Header, { namespaceName: namespaceNameFilter }),
		(0, import_jsx_runtime.jsx)(Grid, { children: sortedWallets.map((wallet) => {
			const isConnected = connectedWalletIds.includes(wallet.id);
			const isConnecting = connectingWalletIds.includes(wallet.id);
			return (0, import_jsx_runtime.jsx)(WalletButton, {
				name: wallet.name,
				icon: wallet.icon,
				active: isConnected,
				variant: "default",
				actionLabel: getActionLabel(isConnected),
				onClick: () => handleWalletClick(wallet),
				disabled: isWalletDisabled(wallet),
				loading: isConnecting,
				supportedNamespaceIcons: getSupportedNamespaceIcons(wallet)
			}, wallet.id);
		}) }),
		(0, import_jsx_runtime.jsx)(WalletConnectButton, {})
	] });
}
//#endregion
//#region node_modules/@trustwallet/connect-ui-logic/dist/views/NamespaceView/NamespaceViewLogic.js
function NamespaceViewLogic({ components }) {
	const { header: Header, grid: Grid, namespaceButton: NamespaceButton } = components;
	const { namespaces } = useNamespaces();
	const { connections } = useConnections();
	const { connect, disconnect } = useConnect();
	const { targetWallet, modalType, setTargetWallet, setNamespaceFilter, setView } = useTrustModal();
	const handleNamespaceClick = async (namespaceId) => {
		if (modalType === "wallet") {
			if (!targetWallet) {
				console.error("No wallet was previously selected, select a wallet before connecting.");
				return;
			}
			const connection = connections[namespaceId];
			if (connection && connection.status === "connected") {
				disconnect({ namespaceId });
				return;
			}
			await handleConnectWallet({
				wallet: targetWallet,
				namespaceId,
				connect
			});
			return;
		}
		if (modalType === "namespace") {
			setTargetWallet(null);
			setNamespaceFilter(namespaceId);
			setView("wallets");
			return;
		}
	};
	return (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [(0, import_jsx_runtime.jsx)(Header, { targetWallet }), (0, import_jsx_runtime.jsx)(Grid, { children: namespaces.map((namespace) => {
		if (targetWallet && !Array.from(targetWallet.namespaceIds).includes(namespace.id)) return;
		const connection = connections[namespace.id];
		const isConnected = connection && connection.status === "connected";
		const connectedWallet = isConnected ? connection.wallet : null;
		const isDifferentWallet = isConnected && targetWallet && connectedWallet?.id !== targetWallet.id;
		const actionLabel = targetWallet ? isConnected ? "Disconnect" : "Connect" : "Select";
		return (0, import_jsx_runtime.jsx)(NamespaceButton, {
			icon: namespace.icon,
			label: namespace.name,
			onClick: () => handleNamespaceClick(namespace.id),
			actionLabel,
			loading: connection?.status === "connecting",
			connectedWallet: isDifferentWallet ? connectedWallet : void 0
		}, namespace.id);
	}) })] });
}
//#endregion
//#region node_modules/@trustwallet/connect-ui-logic/dist/buttons/GetTrustButton/GetTrustButtonLogic.js
function GetTrustButtonLogic({ message, components }) {
	const { wrapper: Wrapper, message: Message, walletButton: WalletButton } = components;
	const handleGetWallet = () => {
		window.open(TRUST_WALLET.INSTALL_LINK, "_blank", "noopener,noreferrer");
	};
	return (0, import_jsx_runtime.jsxs)(Wrapper, { children: [(0, import_jsx_runtime.jsx)(Message, { children: message || "No wallets found. Get Trust Wallet to get started." }), (0, import_jsx_runtime.jsx)(WalletButton, {
		name: TRUST_WALLET.NAME,
		icon: TRUST_WALLET.LOGO,
		actionLabel: "Install",
		onClick: handleGetWallet
	})] });
}
//#endregion
//#region node_modules/@trustwallet/connect-ui-logic/dist/components/Footer/FooterLogic.js
function FooterLogic({ components }) {
	const { wrapper: Wrapper, description: Description, link: Link } = components;
	const handleInstallClick = () => {
		window.open(TRUST_WALLET.INSTALL_LINK, "_blank", "noopener,noreferrer");
	};
	return (0, import_jsx_runtime.jsxs)(Wrapper, { children: [(0, import_jsx_runtime.jsx)(Description, { children: "Don't have a wallet?" }), (0, import_jsx_runtime.jsx)(Link, {
		onClick: handleInstallClick,
		children: "Install Trust Wallet"
	})] });
}
//#endregion
//#region node_modules/@trustwallet/connect-walletconnect/dist/constants.js
var WALLETCONNECT_WALLET = {
	ID: "walletConnect",
	NAME: "WalletConnect",
	TYPE: "caip",
	ICON: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOTYiIGhlaWdodD0iOTYiIHZpZXdCb3g9IjAgMCA5NiA5NiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGcgY2xpcC1wYXRoPSJ1cmwoI2NsaXAwXzJfMjM1NjIpIj4KPHBhdGggZD0iTTk2IDQ4Qzk2IDIxLjQ5MDMgNzQuNTA5NyAwIDQ4IDBDMjEuNDkwMyAwIDAgMjEuNDkwMyAwIDQ4QzAgNzQuNTA5NyAyMS40OTAzIDk2IDQ4IDk2Qzc0LjUwOTcgOTYgOTYgNzQuNTA5NyA5NiA0OFoiIGZpbGw9InVybCgjcGFpbnQwX3JhZGlhbF8yXzIzNTYyKSIvPgo8cGF0aCBkPSJNMzEuNzI3NyAzNC41OTkxQzQwLjcxNTEgMjUuNzk5NiA1NS4yODY3IDI1Ljc5OTYgNjQuMjc0MSAzNC41OTkxTDY1LjM1NTcgMzUuNjU4MUM2NS44MDUxIDM2LjA5ODEgNjUuODA1MSAzNi44MTE0IDY1LjM1NTcgMzcuMjUxNEw2MS42NTU2IDQwLjg3NDFDNjEuNDMwOSA0MS4wOTQxIDYxLjA2NjcgNDEuMDk0MSA2MC44NDIgNDAuODc0MUw1OS4zNTM1IDM5LjQxNjhDNTMuMDgzNiAzMy4yNzgxIDQyLjkxODIgMzMuMjc4MSAzNi42NDgzIDM5LjQxNjhMMzUuMDU0MyA0MC45Nzc1QzM0LjgyOTYgNDEuMTk3NSAzNC40NjUzIDQxLjE5NzUgMzQuMjQwNiA0MC45Nzc1TDMwLjU0MDUgMzcuMzU0OEMzMC4wOTExIDM2LjkxNDggMzAuMDkxMSAzNi4yMDE1IDMwLjU0MDUgMzUuNzYxNUwzMS43Mjc3IDM0LjU5OTFaTTcxLjkyNjMgNDIuMDkxM0w3NS4yMTk0IDQ1LjMxNTVDNzUuNjY4OCA0NS43NTU1IDc1LjY2ODggNDYuNDY4OCA3NS4yMTk0IDQ2LjkwODhMNjAuMzcwNSA2MS40NDczQzU5LjkyMTIgNjEuODg3MyA1OS4xOTI2IDYxLjg4NzMgNTguNzQzMiA2MS40NDczQzU4Ljc0MzIgNjEuNDQ3MyA1OC43NDMyIDYxLjQ0NzMgNTguNzQzMiA2MS40NDczTDQ4LjIwNDQgNTEuMTI4OUM0OC4wOTIgNTEuMDE4OSA0Ny45MDk5IDUxLjAxODkgNDcuNzk3NiA1MS4xMjg5QzQ3Ljc5NzYgNTEuMTI4OSA0Ny43OTc2IDUxLjEyODkgNDcuNzk3NiA1MS4xMjg5TDM3LjI1OSA2MS40NDczQzM2LjgwOTYgNjEuODg3MyAzNi4wODEgNjEuODg3MyAzNS42MzE2IDYxLjQ0NzNDMzUuNjMxNiA2MS40NDczIDM1LjYzMTYgNjEuNDQ3MyAzNS42MzE2IDYxLjQ0NzNMMjAuNzgyMyA0Ni45MDg2QzIwLjMzMyA0Ni40Njg2IDIwLjMzMyA0NS43NTUzIDIwLjc4MjMgNDUuMzE1M0wyNC4wNzU1IDQyLjA5MTFDMjQuNTI0OCA0MS42NTExIDI1LjI1MzQgNDEuNjUxMSAyNS43MDI4IDQyLjA5MTFMMzYuMjQxOCA1Mi40MDk2QzM2LjM1NDEgNTIuNTE5NiAzNi41MzYyIDUyLjUxOTYgMzYuNjQ4NiA1Mi40MDk2QzM2LjY0ODYgNTIuNDA5NiAzNi42NDg2IDUyLjQwOTYgMzYuNjQ4NiA1Mi40MDk2TDQ3LjE4NyA0Mi4wOTExQzQ3LjYzNjQgNDEuNjUxMSA0OC4zNjUgNDEuNjUxMSA0OC44MTQ0IDQyLjA5MTFDNDguODE0NCA0Mi4wOTExIDQ4LjgxNDQgNDIuMDkxMSA0OC44MTQ0IDQyLjA5MTFMNTkuMzUzMyA1Mi40MDk2QzU5LjQ2NTcgNTIuNTE5NiA1OS42NDc4IDUyLjUxOTYgNTkuNzYwMiA1Mi40MDk2TDcwLjI5OSA0Mi4wOTEzQzcwLjc0ODMgNDEuNjUxMyA3MS40NzY5IDQxLjY1MTMgNzEuOTI2MyA0Mi4wOTEzWiIgZmlsbD0id2hpdGUiLz4KPC9nPgo8ZGVmcz4KPHJhZGlhbEdyYWRpZW50IGlkPSJwYWludDBfcmFkaWFsXzJfMjM1NjIiIGN4PSIwIiBjeT0iMCIgcj0iMSIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIGdyYWRpZW50VHJhbnNmb3JtPSJ0cmFuc2xhdGUoMCA0OCkgc2NhbGUoOTYpIj4KPHN0b3Agc3RvcC1jb2xvcj0iIzVEOURGNiIvPgo8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMwMDZGRkYiLz4KPC9yYWRpYWxHcmFkaWVudD4KPGNsaXBQYXRoIGlkPSJjbGlwMF8yXzIzNTYyIj4KPHJlY3Qgd2lkdGg9Ijk2IiBoZWlnaHQ9Ijk2IiBmaWxsPSJ3aGl0ZSIvPgo8L2NsaXBQYXRoPgo8L2RlZnM+Cjwvc3ZnPgo="
};
//#endregion
//#region node_modules/@trustwallet/connect-walletconnect/dist/react/hooks/useWalletConnectService.js
/**
* Internal hook to get the WalletConnect service instance
* @returns WalletConnectService instance or undefined if not configured
*/
function useWalletConnectService() {
	const { client } = useTrustConnectContext();
	return (0, import_react.useMemo)(() => {
		return client.getServices().find((service) => service.id === WALLETCONNECT_WALLET.ID);
	}, [client]);
}
//#endregion
//#region node_modules/@trustwallet/connect-walletconnect/dist/errors/index.js
var WalletConnectClientNotAvailableError = class extends BaseError {
	constructor() {
		super("WalletConnect client not available", "WALLETCONNECT_CLIENT_NOT_AVAILABLE");
		this.name = "WalletConnectClientNotAvailableError";
	}
};
var WalletConnectServiceNotAvailableError = class extends BaseError {
	constructor() {
		super("WalletConnect service not available", "WALLETCONNECT_SERVICE_NOT_AVAILABLE");
		this.name = "WalletConnectServiceNotAvailableError";
	}
};
var LinkNotReadyError = class extends BaseError {
	constructor() {
		super("Link is not ready. Generate URI first by calling prepareLink().", "LINK_NOT_READY");
		this.name = "LinkNotReadyError";
	}
};
var MissingMobileDeepLinkError = class extends BaseError {
	constructor(walletName) {
		super(`Wallet ${walletName} does not have a mobile deep link.`, "MISSING_MOBILE_DEEP_LINK", { walletName });
		this.name = "MissingMobileDeepLinkError";
	}
};
var WalletConnectServiceNotInitializedError = class extends BaseError {
	constructor() {
		super("WalletConnect service has not initialized", "WALLETCONNECT_SERVICE_NOT_INITIALIZED");
		this.name = "WalletConnectServiceNotInitializedError";
	}
};
var CaipWalletNotInitializedError = class extends BaseError {
	constructor() {
		super("CaipWallet not initialized.", "CAIP_WALLET_NOT_INITIALIZED");
		this.name = "CaipWalletNotInitializedError";
	}
};
var WalletConnectExplorerApiError = class extends BaseError {
	constructor(status, statusText) {
		super(`Failed to fetch wallets: ${status} ${statusText}`, "WALLETCONNECT_EXPLORER_API_ERROR", {
			status,
			statusText
		});
		this.name = "WalletConnectExplorerApiError";
	}
};
//#endregion
//#region node_modules/@trustwallet/connect-walletconnect/dist/react/hooks/useWalletConnect.js
/**
* Hook to get the WalletConnect URI and generate it
* Subscribes to URI changes
* @returns Object with uri, generateUri, isUriLoading, uriError, and wallet
*/
function useWalletConnect() {
	const service = useWalletConnectService();
	const { connect, isLoading, error } = useConnect();
	const generateUri = (0, import_react.useCallback)(async () => {
		if (!service) throw new WalletConnectClientNotAvailableError();
		const wallet = service.getCaipWallet();
		if (!wallet) throw new CaipWalletNotInitializedError();
		service.setUri("");
		await connect({ wallet });
	}, [connect, service]);
	const openWalletLink = (0, import_react.useCallback)((wallet) => {
		if (!service) throw new WalletConnectServiceNotAvailableError();
		const currentUri = service.getUri();
		if (!currentUri) throw new LinkNotReadyError();
		const mobileLink = wallet.mobile?.universal || wallet.mobile?.native || wallet.mobile_link;
		if (!mobileLink) throw new MissingMobileDeepLinkError(wallet.name);
		const deepLink = `${mobileLink}wc?uri=${encodeURIComponent(currentUri)}`;
		window.open(deepLink, "_blank", "noreferrer noopener");
	}, [service]);
	const uri = (0, import_react.useSyncExternalStore)((callback) => {
		if (!service) return () => {};
		return service.onUri(() => callback());
	}, () => service?.getUri(), () => service?.getUri());
	const wallet = (0, import_react.useMemo)(() => {
		return service?.getCaipWallet();
	}, [service]);
	return {
		uri,
		generateUri,
		openWalletLink,
		isUriLoading: isLoading && !uri,
		error,
		wallet
	};
}
//#endregion
//#region node_modules/@trustwallet/connect-walletconnect/dist/explorer-api/index.js
/**
* WalletConnect Explorer API
* Reference: https://docs.walletconnect.network/walletguide/explorer
*/
var WalletConnectExplorer = class {
	constructor(projectId, searchDebounceMs = 300) {
		this.baseUrl = "https://explorer-api.walletconnect.com/v3";
		this.searchDebounceTimer = null;
		this.pendingSearchPromise = null;
		this.projectId = projectId;
		this.searchDebounceMs = searchDebounceMs;
	}
	/**
	* Fetches wallets from the WalletConnect Explorer API
	* - Search queries are debounced
	* @param options - Filtering and pagination options
	* @returns Promise with wallets response
	*/
	async fetchWallets(options = {}) {
		if (Boolean(options.search && options.search.trim())) return this.fetchWalletsWithDebounce(options);
		return this.fetchFromApi(options);
	}
	/**
	* Fetches wallets with debounce for search queries
	*/
	async fetchWalletsWithDebounce(options) {
		if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
		if (this.pendingSearchPromise) return this.pendingSearchPromise;
		this.pendingSearchPromise = new Promise((resolve, reject) => {
			this.searchDebounceTimer = setTimeout(async () => {
				try {
					const result = await this.fetchFromApi(options);
					this.pendingSearchPromise = null;
					resolve(result);
				} catch (error) {
					this.pendingSearchPromise = null;
					reject(error);
				}
			}, this.searchDebounceMs);
		});
		return this.pendingSearchPromise;
	}
	/**
	* Performs the actual API fetch
	*/
	async fetchFromApi(options) {
		const params = this.buildWalletsQueryParams(options);
		const url = `${this.baseUrl}/wallets?${params.toString()}`;
		try {
			const response = await fetch(url);
			if (!response.ok) throw new WalletConnectExplorerApiError(response.status, response.statusText);
			const rawData = await response.json();
			const walletsArray = Object.values(rawData.listings);
			return {
				count: walletsArray.length,
				data: walletsArray.map((wallet) => ({
					...wallet,
					iconUrl: this.getLogoUrl(wallet.image_id, "md")
				}))
			};
		} catch (error) {
			throw new Error(`Error fetching wallets from Explorer API: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	/**
	* Gets the logo URL for a wallet
	* @param imageId - The image_id from the explorer entry
	* @param size - Size of the logo (sm, md, or lg)
	* @returns The logo URL
	*/
	getLogoUrl(imageId, size = "md") {
		return `${this.baseUrl}/logo/${size}/${imageId}?projectId=${this.projectId}`;
	}
	buildWalletsQueryParams(options) {
		const params = new URLSearchParams({ projectId: this.projectId });
		if (options.page !== void 0 && options.entries !== void 0) {
			params.append("page", String(options.page));
			params.append("entries", String(options.entries));
		}
		if (options.search) params.append("search", options.search);
		if (options.ids && options.ids.length > 0) params.append("ids", options.ids.join(","));
		if (options.chains && options.chains.length > 0) params.append("chains", options.chains.join(","));
		if (options.platforms && options.platforms.length > 0) params.append("platforms", options.platforms.join(","));
		if (options.sdks && options.sdks.length > 0) params.append("sdks", options.sdks.join(","));
		if (options.standards && options.standards.length > 0) params.append("standards", options.standards.join(","));
		return params;
	}
};
//#endregion
//#region node_modules/@trustwallet/connect-walletconnect/dist/react/hooks/useWalletConnectExplorer.js
/**
* Hook to fetch and paginate WalletConnect explorer wallets
* @param query - Optional search query to filter wallets
* @returns Wallets data, loading states, and pagination controls
*/
function useWalletConnectExplorer({ query, entries } = {
	query: "",
	entries: 10
}) {
	const service = useWalletConnectService();
	if (!service) throw new WalletConnectServiceNotInitializedError();
	const explorer = (0, import_react.useMemo)(() => {
		return new WalletConnectExplorer(service.projectId);
	}, [service]);
	const [wallets, setWallets] = (0, import_react.useState)([]);
	const [isLoading, setIsLoading] = (0, import_react.useState)(false);
	const [isLoadingMore, setIsLoadingMore] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const [hasMore, setHasMore] = (0, import_react.useState)(true);
	const pageRef = (0, import_react.useRef)(1);
	const platform = getPlatform();
	const fetchWallets = (0, import_react.useCallback)(async (search, reset = false) => {
		if (reset) {
			pageRef.current = 1;
			setWallets([]);
			setHasMore(true);
		}
		if (reset) setIsLoading(true);
		else setIsLoadingMore(true);
		setError(null);
		try {
			const response = await explorer.fetchWallets({
				page: pageRef.current,
				entries: entries || 10,
				search,
				platforms: platform === "desktop" ? void 0 : [platform]
			});
			if (reset) setWallets(response.data);
			else setWallets((prev) => [...prev, ...response.data]);
			setHasMore(response.data.length === 10);
			pageRef.current += 1;
		} catch (err) {
			setError(err instanceof Error ? err : /* @__PURE__ */ new Error("Failed to fetch wallets"));
		} finally {
			setIsLoading(false);
			setIsLoadingMore(false);
		}
	}, [explorer, platform]);
	const loadMore = (0, import_react.useCallback)(() => {
		if (!isLoadingMore && hasMore) fetchWallets(query, false);
	}, [
		fetchWallets,
		query,
		isLoadingMore,
		hasMore
	]);
	(0, import_react.useEffect)(() => {
		const timer = setTimeout(() => {
			fetchWallets(query, true);
		}, 300);
		return () => clearTimeout(timer);
	}, [query, fetchWallets]);
	return {
		wallets,
		isLoading,
		isLoadingMore,
		error,
		hasMore,
		loadMore
	};
}
//#endregion
//#region node_modules/@trustwallet/connect-ui-logic/dist/buttons/WalletConnectButton/WalletConnectButtonLogic.js
function WalletConnectButtonLogic({ components }) {
	const { title: Title, grid: Grid, walletButton: WalletButton } = components;
	const { wallet, generateUri } = useWalletConnect();
	const { setView } = useTrustModal();
	const { connectedWalletIds, connectingWalletIds } = useWalletIds();
	const { disconnect } = useConnect();
	if (!wallet) return null;
	const isConnected = connectedWalletIds.includes(wallet.id);
	const isConnecting = connectingWalletIds.includes(wallet.id);
	const isDisabled = connectedWalletIds.length > 0 && !connectedWalletIds.includes(wallet.id);
	const handleClick = async () => {
		if (isConnected) {
			disconnect();
			return;
		}
		setView("qr");
		await generateUri();
	};
	return (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [(0, import_jsx_runtime.jsx)(Title, {}), (0, import_jsx_runtime.jsx)(Grid, { children: (0, import_jsx_runtime.jsx)(WalletButton, {
		name: wallet.name,
		icon: wallet.icon,
		active: isConnected,
		variant: "walletconnect",
		actionLabel: isConnected ? "Disconnect" : "Connect",
		onClick: handleClick,
		disabled: isDisabled,
		loading: isConnecting
	}, wallet.id) })] });
}
//#endregion
//#region node_modules/@trustwallet/connect-ui-logic/dist/views/QRView/QRViewLogic.js
function QRViewLogic({ components }) {
	const { wrapper: Wrapper, placeholder: Placeholder, qrCode: QRCode, actions: Actions, button: Button, error: Error, spinner: Spinner } = components;
	const arena = (0, import_react.useMemo)(() => WALLETCONNECT_WALLET.ICON, []);
	const { uri, isUriLoading, error, wallet } = useWalletConnect();
	const { copied, copy } = useCopyToClipboard();
	const { close } = useTrustModal();
	const { connectedWalletIds } = useWalletIds();
	const handleCopy = async () => {
		if (!uri) return;
		await copy(uri);
	};
	(0, import_react.useEffect)(() => {
		if (wallet && connectedWalletIds.includes(wallet.id)) close();
	}, [wallet, connectedWalletIds]);
	return (0, import_jsx_runtime.jsxs)(Wrapper, { children: [
		isUriLoading || !uri ? (0, import_jsx_runtime.jsx)(Placeholder, { children: (0, import_jsx_runtime.jsx)(Spinner, {}) }) : (0, import_jsx_runtime.jsx)(QRCode, {
			arena,
			value: uri
		}),
		(0, import_jsx_runtime.jsx)(Actions, { children: (0, import_jsx_runtime.jsx)(Button, {
			onClick: handleCopy,
			disabled: !uri || isUriLoading,
			children: copied ? "Copied!" : "Copy to clipboard"
		}) }),
		error && (0, import_jsx_runtime.jsx)(Error, { message: error.message })
	] });
}
//#endregion
//#region node_modules/@trustwallet/connect-ui-logic/dist/views/MobileWalletsView/MobileWalletsViewLogic.js
function MobileWalletsViewLogic({ components }) {
	const { wrapper: Wrapper, search: Search, loading: Loading, emptyState: EmptyState, walletsList: WalletsList, footer: Footer } = components;
	const [searchQuery, setSearchQuery] = (0, import_react.useState)("");
	const [connectingWalletId, setConnectingWalletId] = (0, import_react.useState)(null);
	const [connectionErrorMessage, setConnectionErrorMessage] = (0, import_react.useState)(null);
	const { close } = useTrustModal();
	const { isConnectionAborted } = useConnect();
	const { error: connectionError, openWalletLink, generateUri, isUriLoading, uri } = useWalletConnect();
	const { wallets, isLoading, isLoadingMore, error, hasMore, loadMore } = useWalletConnectExplorer({ query: searchQuery });
	const scrollRef = (0, import_react.useRef)(null);
	const handleWalletClick = async (wallet) => {
		setConnectingWalletId(wallet.id);
		setConnectionErrorMessage(null);
		openWalletLink(wallet);
	};
	async function handleUriAndAwait() {
		await generateUri();
		if (!error && !isConnectionAborted) close();
	}
	(0, import_react.useEffect)(() => {
		if (!uri && !isUriLoading) handleUriAndAwait();
	}, [uri, isUriLoading]);
	(0, import_react.useEffect)(() => {
		if (connectionError && connectingWalletId) {
			setConnectionErrorMessage(connectionError.message);
			setConnectingWalletId(null);
		}
	}, [connectionError, connectingWalletId]);
	(0, import_react.useEffect)(() => {
		const scrollContainer = scrollRef.current;
		if (!scrollContainer) return;
		let timeoutId = null;
		const handleScroll = () => {
			if (timeoutId) return;
			timeoutId = setTimeout(() => {
				const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
				if (scrollHeight - scrollTop - clientHeight < 100 && hasMore && !isLoadingMore) loadMore();
				timeoutId = null;
			}, 150);
		};
		scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
		return () => {
			scrollContainer.removeEventListener("scroll", handleScroll);
			if (timeoutId) clearTimeout(timeoutId);
		};
	}, [
		hasMore,
		isLoadingMore,
		loadMore,
		wallets.length,
		isLoading,
		isUriLoading
	]);
	if (error) return (0, import_jsx_runtime.jsx)(EmptyState, {});
	const showLoading = isLoading || isUriLoading;
	return (0, import_jsx_runtime.jsxs)(Wrapper, { children: [
		(0, import_jsx_runtime.jsx)(Search, {
			searchQuery,
			setSearchQuery,
			uri
		}),
		showLoading && (0, import_jsx_runtime.jsx)(Loading, {}),
		!showLoading && wallets.length === 0 && (0, import_jsx_runtime.jsx)(EmptyState, { searchQuery }),
		!showLoading && wallets.length > 0 && (0, import_jsx_runtime.jsx)(WalletsList, {
			wallets,
			connectingWalletId,
			connectionError: connectionErrorMessage,
			isLoadingMore,
			scrollRef,
			onWalletClick: handleWalletClick
		}),
		(0, import_jsx_runtime.jsx)(Footer, {})
	] });
}
//#endregion
//#region node_modules/qr/index.js
/*!
Copyright (c) 2023 Paul Miller (paulmillr.com)
The library paulmillr-qr is dual-licensed under the Apache 2.0 OR MIT license.
You can select a license of your choice.
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
var chCodes = {
	newline: 10,
	reset: 27
};
function assertNumber(n) {
	if (!Number.isSafeInteger(n)) throw new Error(`integer expected: ${n}`);
}
function validateVersion(ver) {
	if (!Number.isSafeInteger(ver) || ver < 1 || ver > 40) throw new Error(`Invalid version=${ver}. Expected number [1..40]`);
}
function bin(dec, pad) {
	return dec.toString(2).padStart(pad, "0");
}
function mod(a, b) {
	const result = a % b;
	return result >= 0 ? result : b + result;
}
function fillArr(length, val) {
	return new Array(length).fill(val);
}
function popcnt(n) {
	n = n - (n >>> 1 & 1431655765);
	n = (n & 858993459) + (n >>> 2 & 858993459);
	return (n + (n >>> 4) & 252645135) * 16843009 >>> 24;
}
/**
* Interleaves byte blocks.
* @param blocks [[1, 2, 3], [4, 5, 6]]
* @returns [1, 4, 2, 5, 3, 6]
*/
function interleaveBytes(blocks) {
	let maxLen = 0;
	let totalLen = 0;
	for (const block of blocks) {
		maxLen = Math.max(maxLen, block.length);
		totalLen += block.length;
	}
	const result = new Uint8Array(totalLen);
	let idx = 0;
	for (let i = 0; i < maxLen; i++) for (const block of blocks) if (i < block.length) result[idx++] = block[i];
	return result;
}
function best() {
	let best;
	let bestScore = Infinity;
	return {
		add(score, value) {
			if (score >= bestScore) return;
			best = value;
			bestScore = score;
		},
		get: () => best,
		score: () => bestScore
	};
}
function alphabet(alphabet) {
	return Object.freeze({
		has: (char) => alphabet.includes(char),
		decode: (input) => {
			if (!Array.isArray(input) || input.length && typeof input[0] !== "string") throw new Error("alphabet.decode input should be array of strings");
			return input.map((letter) => {
				if (typeof letter !== "string") throw new Error(`alphabet.decode: not string element=${letter}`);
				const index = alphabet.indexOf(letter);
				if (index === -1) throw new Error(`Unknown letter: "${letter}". Allowed: ${alphabet}`);
				return index;
			});
		},
		encode: (digits) => {
			if (!Array.isArray(digits) || digits.length && typeof digits[0] !== "number") throw new Error("alphabet.encode input should be an array of numbers");
			return digits.map((i) => {
				assertNumber(i);
				if (i < 0 || i >= alphabet.length) throw new Error(`Digit index outside alphabet: ${i} (alphabet: ${alphabet.length})`);
				return alphabet[i];
			});
		}
	});
}
function transpose32(a) {
	if (a.length !== 32) throw new Error("expects 32 element matrix");
	const masks = [
		1431655765,
		858993459,
		252645135,
		16711935,
		65535
	];
	for (let stage = 0; stage < 5; stage++) {
		const m = masks[stage] >>> 0;
		const s = 1 << stage;
		const step = s << 1;
		for (let i = 0; i < 32; i += step) for (let k = 0; k < s; k++) {
			const i0 = i + k;
			const i1 = i0 + s;
			const x = a[i0] >>> 0;
			const y = a[i1] >>> 0;
			const t = (x >>> s ^ y) & m;
			a[i0] = (x ^ t << s) >>> 0;
			a[i1] = (y ^ t) >>> 0;
		}
	}
}
var bitMask = (x) => 1 << (x & 31) >>> 0;
var rangeMask = (shift, len) => {
	if (len === 0) return 0;
	if (len === 32) return 4294967295;
	return (1 << len) - 1 << shift >>> 0;
};
/**
* Mutable monochrome bitmap used as the internal QR representation.
* @param size - Square edge length or explicit bitmap dimensions.
* @param data - Optional row-major pixel matrix using `true`, `false`, or `undefined`.
* @example
* Create a bitmap, then scale it for display.
* ```ts
* import { Bitmap } from 'qr';
* const bitmap = Bitmap.fromString('X \n X');
* bitmap.scale(2);
* ```
*/
var Bitmap = class Bitmap {
	static size(size, limit) {
		if (typeof size === "number") size = {
			height: size,
			width: size
		};
		if (!Number.isSafeInteger(size.height) && size.height !== Infinity) throw new Error(`Bitmap: invalid height=${size.height} (${typeof size.height})`);
		if (!Number.isSafeInteger(size.width) && size.width !== Infinity) throw new Error(`Bitmap: invalid width=${size.width} (${typeof size.width})`);
		if (limit !== void 0) size = {
			width: Math.min(size.width, limit.width),
			height: Math.min(size.height, limit.height)
		};
		return size;
	}
	static fromString(s) {
		s = s.replace(/^\n+/g, "").replace(/\n+$/g, "");
		const lines = s.split(String.fromCharCode(chCodes.newline));
		const height = lines.length;
		let width;
		const rows = [];
		for (const line of lines) {
			const row = line.split("").map((i) => {
				if (i === "X") return true;
				if (i === " ") return false;
				if (i === "?") return void 0;
				throw new Error(`Bitmap.fromString: unknown symbol=${i}`);
			});
			if (width !== void 0 && row.length !== width) throw new Error(`Bitmap.fromString different row sizes: width=${width} cur=${row.length}`);
			width = row.length;
			rows.push(row);
		}
		if (width === void 0) width = 0;
		return new Bitmap({
			height,
			width
		}, rows);
	}
	defined;
	value;
	tailMask;
	words;
	fullWords;
	height;
	width;
	constructor(size, data) {
		const { height, width } = Bitmap.size(size);
		if (!Number.isSafeInteger(height) || height <= 0) throw new Error(`Bitmap: invalid height=${height}, expected positive safe integer dimension`);
		if (!Number.isSafeInteger(width) || width <= 0) throw new Error(`Bitmap: invalid width=${width}, expected positive safe integer dimension`);
		this.height = height;
		this.width = width;
		this.tailMask = rangeMask(0, width & 31 || 32);
		this.words = Math.ceil(width / 32) | 0;
		this.fullWords = Math.floor(width / 32) | 0;
		this.value = new Uint32Array(this.words * height);
		this.defined = new Uint32Array(this.value.length);
		if (data) {
			if (data.length !== height) throw new Error(`Bitmap: data height mismatch: exp=${height} got=${data.length}`);
			for (let y = 0; y < height; y++) {
				const row = data[y];
				if (!row || row.length !== width) throw new Error(`Bitmap: data width mismatch at y=${y}: exp=${width} got=${row?.length}`);
				for (let x = 0; x < width; x++) this.set(x, y, row[x]);
			}
		}
	}
	point(p) {
		return this.get(p.x, p.y);
	}
	isInside(p) {
		return 0 <= p.x && p.x < this.width && 0 <= p.y && p.y < this.height;
	}
	size(offset) {
		if (!offset) return {
			height: this.height,
			width: this.width
		};
		const { x, y } = this.xy(offset);
		return {
			height: this.height - y,
			width: this.width - x
		};
	}
	xy(c) {
		if (typeof c === "number") c = {
			x: c,
			y: c
		};
		if (!Number.isSafeInteger(c.x)) throw new Error(`Bitmap: invalid x=${c.x}`);
		if (!Number.isSafeInteger(c.y)) throw new Error(`Bitmap: invalid y=${c.y}`);
		c.x = mod(c.x, this.width);
		c.y = mod(c.y, this.height);
		return c;
	}
	/**
	* Return pixel bit index
	*/
	wordIndex(x, y) {
		return y * this.words + (x >>> 5);
	}
	bitIndex(x, y) {
		return {
			word: this.wordIndex(x, y),
			bit: x & 31
		};
	}
	isDefined(x, y) {
		const wi = this.wordIndex(x, y);
		const m = bitMask(x);
		return (this.defined[wi] & m) !== 0;
	}
	get(x, y) {
		const wi = this.wordIndex(x, y);
		const m = bitMask(x);
		return (this.value[wi] & m) !== 0;
	}
	maskWord(wi, mask, v) {
		const { defined, value } = this;
		defined[wi] |= mask;
		value[wi] = value[wi] & ~mask | -v & mask;
	}
	set(x, y, v) {
		if (v === void 0) return;
		this.maskWord(this.wordIndex(x, y), bitMask(x), v);
	}
	fillRectConst(x0, y0, w, h, v) {
		if (w <= 0 || h <= 0) return;
		if (v === void 0) return;
		const { value, defined, words } = this;
		const startWord = x0 >>> 5;
		const endWord = x0 + w - 1 >>> 5;
		const startBit = x0 & 31;
		const endBit = x0 + w - 1 & 31;
		for (let ry = 0; ry < h; ry++) {
			const rowBase = (y0 + ry) * words;
			if (startWord === endWord) {
				const mask = rangeMask(startBit, endBit - startBit + 1);
				this.maskWord(rowBase + startWord, mask, v);
				continue;
			}
			this.maskWord(rowBase + startWord, rangeMask(startBit, 32 - startBit), v);
			for (let i = startWord + 1; i < endWord; i++) {
				defined[rowBase + i] = 4294967295;
				value[rowBase + i] = v ? 4294967295 : 0;
			}
			this.maskWord(rowBase + endWord, rangeMask(0, endBit + 1), v);
		}
	}
	rectWords(x, y, width, height, cb) {
		for (let yPos = 0; yPos < height; yPos++) {
			const Py = y + yPos;
			for (let xPos = 0; xPos < width;) {
				const bitX = x + xPos;
				const { bit, word } = this.bitIndex(bitX, Py);
				const bitsPerWord = Math.min(32 - bit, width - xPos);
				cb(word, bitX, xPos, yPos, bitsPerWord);
				xPos += bitsPerWord;
			}
		}
	}
	rect(c, size, fn) {
		const { x, y } = this.xy(c);
		const { height, width } = Bitmap.size(size, this.size({
			x,
			y
		}));
		if (typeof fn !== "function") {
			this.fillRectConst(x, y, width, height, fn);
			return this;
		}
		const { defined, value } = this;
		this.rectWords(x, y, width, height, (wi, bitX, xPos, yPos, n) => {
			let defWord = 0;
			let valWord = value[wi];
			for (let b = 0; b < n; b++) {
				const mask = bitMask(bitX + b);
				const res = fn({
					x: xPos + b,
					y: yPos
				}, (valWord & mask) !== 0);
				if (res === void 0) continue;
				defWord |= mask;
				valWord = valWord & ~mask | -res & mask;
			}
			defined[wi] |= defWord;
			value[wi] = valWord;
		});
		return this;
	}
	rectRead(c, size, fn) {
		const { x, y } = this.xy(c);
		const { height, width } = Bitmap.size(size, this.size({
			x,
			y
		}));
		const { value } = this;
		this.rectWords(x, y, width, height, (wi, bitX, xPos, yPos, n) => {
			const valWord = value[wi];
			for (let b = 0; b < n; b++) {
				const mask = bitMask(bitX + b);
				fn({
					x: xPos + b,
					y: yPos
				}, (valWord & mask) !== 0);
			}
		});
		return this;
	}
	hLine(c, len, value) {
		return this.rect(c, {
			width: len,
			height: 1
		}, value);
	}
	vLine(c, len, value) {
		return this.rect(c, {
			width: 1,
			height: len
		}, value);
	}
	border(border = 2, value) {
		if (!Number.isSafeInteger(border) || border <= 0) throw new Error(`Bitmap.border: invalid size=${border}`);
		const out = new Bitmap({
			height: this.height + 2 * border,
			width: this.width + 2 * border
		});
		out.rect(0, Infinity, value);
		out.embed({
			x: border,
			y: border
		}, this);
		return out;
	}
	embed(c, src) {
		const { x, y } = this.xy(c);
		const { height, width } = Bitmap.size(src.size(), this.size({
			x,
			y
		}));
		if (width <= 0 || height <= 0) return this;
		const { value, defined } = this;
		const { words: srcStride, value: srcValue } = src;
		for (let yPos = 0; yPos < height; yPos++) {
			const srcRow = yPos * srcStride;
			for (let xPos = 0; xPos < width;) {
				const dstX = x + xPos;
				const { word: dstWord, bit: dstBit } = this.bitIndex(dstX, y + yPos);
				const { word: srcWord, bit: srcBit } = src.bitIndex(xPos, yPos);
				const len = Math.min(32 - dstBit, width - xPos);
				const w0 = srcValue[srcWord];
				const w1 = srcBit && srcWord + 1 < srcRow + srcStride ? srcValue[srcWord + 1] : 0;
				const sVal = srcBit ? (w0 >>> srcBit | w1 << 32 - srcBit) >>> 0 : w0;
				const dstMask = rangeMask(dstBit, len);
				const valBits = (sVal & rangeMask(0, len)) << dstBit >>> 0;
				defined[dstWord] |= dstMask;
				value[dstWord] = value[dstWord] & ~dstMask | valBits;
				xPos += len;
			}
		}
		return this;
	}
	rectSlice(c, size = this.size()) {
		const { x, y } = this.xy(c);
		const { height, width } = Bitmap.size(size, this.size({
			x,
			y
		}));
		const rect = new Bitmap({
			height,
			width
		});
		this.rectRead({
			x,
			y
		}, {
			height,
			width
		}, (p, cur) => {
			if (this.isDefined(x + p.x, y + p.y)) rect.set(p.x, p.y, cur);
		});
		return rect;
	}
	transpose() {
		const { height, width, value, defined, words } = this;
		const dst = new Bitmap({
			height: width,
			width: height
		});
		const { words: dstStride, value: dstValue, defined: dstDefined, tailMask: dstTail } = dst;
		const tmpV = new Uint32Array(32);
		const tmpD = new Uint32Array(32);
		for (let by = 0; by < height; by += 32) for (let bx = 0; bx < words; bx++) {
			const rows = Math.min(32, height - by);
			for (let r = 0; r < rows; r++) {
				const wi = this.wordIndex(32 * bx, by + r);
				tmpV[r] = value[wi];
				tmpD[r] = defined[wi];
			}
			tmpV.fill(0, rows);
			tmpD.fill(0, rows);
			transpose32(tmpV);
			transpose32(tmpD);
			for (let i = 0; i < 32; i++) {
				const dstY = bx * 32 + i;
				if (dstY >= width) break;
				const dstPos = dst.wordIndex(by, dstY);
				const curMask = by >>> 5 === dstStride - 1 ? dstTail : 4294967295;
				dstValue[dstPos] = tmpV[i] & curMask;
				dstDefined[dstPos] = tmpD[i] & curMask;
			}
		}
		return dst;
	}
	negate() {
		const n = this.defined.length;
		for (let i = 0; i < n; i++) {
			this.value[i] = ~this.value[i];
			this.defined[i] = 4294967295;
		}
		return this;
	}
	scale(factor) {
		if (!Number.isSafeInteger(factor) || factor > 1024) throw new Error(`invalid scale factor: ${factor}`);
		const { height, width } = this;
		return new Bitmap({
			height: factor * height,
			width: factor * width
		}).rect({
			x: 0,
			y: 0
		}, Infinity, ({ x, y }) => this.get(x / factor | 0, y / factor | 0));
	}
	clone() {
		const res = new Bitmap(this.size());
		res.defined.set(this.defined);
		res.value.set(this.value);
		return res;
	}
	assertDrawn() {
		const { height, width, defined, tailMask, fullWords, words } = this;
		if (!height || !width) return;
		for (let y = 0; y < height; y++) {
			const rowBase = y * words;
			for (let wi = 0; wi < fullWords; wi++) if (defined[rowBase + wi] !== 4294967295) throw new Error(`Invalid color type=undefined`);
			if (words !== fullWords && (defined[rowBase + fullWords] & tailMask) !== tailMask) throw new Error(`Invalid color type=undefined`);
		}
	}
	countPatternInRow(y, patternLen, ...patterns) {
		if (!Number.isSafeInteger(patternLen) || patternLen <= 0 || patternLen >= 32) throw new Error("wrong patternLen");
		const mask = (1 << patternLen) - 1;
		const { height, width, value, words } = this;
		if (!Number.isSafeInteger(y) || y < 0 || y >= height) return 0;
		let count = 0;
		const rowBase = this.wordIndex(0, y);
		for (let i = 0, window = 0; i < words; i++) {
			const w = value[rowBase + i];
			const bitEnd = i === words - 1 ? width & 31 || 32 : 32;
			for (let b = 0; b < bitEnd; b++) {
				window = (window << 1 | w >>> b & 1) & mask;
				if (i * 32 + b + 1 < patternLen) continue;
				for (const p of patterns) {
					if (window !== p) continue;
					count++;
					break;
				}
			}
		}
		return count;
	}
	getRuns(y, fn) {
		const { height, width, value, words } = this;
		if (width === 0) return;
		if (!Number.isSafeInteger(y) || y < 0 || y >= height) return;
		let runLen = 0;
		let runValue;
		const rowBase = this.wordIndex(0, y);
		for (let i = 0; i < words; i++) {
			const word = value[rowBase + i];
			const bitEnd = i === words - 1 ? width & 31 || 32 : 32;
			for (let b = 0; b < bitEnd; b++) {
				const bit = (word & 1 << b) !== 0;
				if (bit === runValue) {
					runLen++;
					continue;
				}
				if (runValue !== void 0) fn(runLen, runValue);
				runValue = bit;
				runLen = 1;
			}
		}
		if (runValue !== void 0) fn(runLen, runValue);
	}
	popcnt() {
		const { height, width, words, fullWords, tailMask } = this;
		if (!height || !width) return 0;
		let count = 0;
		for (let y = 0; y < height; y++) {
			const rowBase = y * words;
			for (let wi = 0; wi < fullWords; wi++) count += popcnt(this.value[rowBase + wi]);
			if (words !== fullWords) count += popcnt(this.value[rowBase + fullWords] & tailMask);
		}
		return count;
	}
	countBoxes2x2(y) {
		const { height, width, words } = this;
		if (width < 2 || !Number.isSafeInteger(y) || y < 0 || y + 1 >= height) return 0;
		const base0 = this.wordIndex(0, y);
		const base1 = this.wordIndex(0, y + 1);
		const validLast = (width & 31) === 0 ? 2147483647 : rangeMask(0, width - 1 & 31);
		let boxes = 0;
		for (let wi = 0; wi < words; wi++) {
			const a0 = this.value[base0 + wi];
			const a1 = this.value[base1 + wi];
			const eqV = ~(a0 ^ a1) >>> 0;
			const n0 = wi + 1 < words ? this.value[base0 + wi + 1] >>> 0 : 0;
			const eqH0 = ~(a0 ^ (a0 >>> 1 | (n0 & 1) << 31) >>> 0) >>> 0;
			const n1 = wi + 1 < words ? this.value[base1 + wi + 1] >>> 0 : 0;
			const eqH1 = ~(a1 ^ (a1 >>> 1 | (n1 & 1) << 31) >>> 0) >>> 0;
			let m = (eqV & eqH0 & eqH1) >>> 0;
			if (wi === words - 1) m &= validLast;
			boxes += popcnt(m);
		}
		return boxes;
	}
	toString() {
		const nl = String.fromCharCode(chCodes.newline);
		let out = "";
		for (let y = 0; y < this.height; y++) {
			let line = "";
			for (let x = 0; x < this.width; x++) {
				const v = this.get(x, y);
				line += !this.isDefined(x, y) ? "?" : v ? "X" : " ";
			}
			out += line + (y + 1 === this.height ? "" : nl);
		}
		return out;
	}
	toRaw() {
		const out = Array.from({ length: this.height }, () => new Array(this.width));
		for (let y = 0; y < this.height; y++) {
			const row = out[y];
			for (let x = 0; x < this.width; x++) row[x] = this.get(x, y);
		}
		return out;
	}
	toASCII() {
		const { height, width } = this;
		let out = "";
		for (let y = 0; y < height; y += 2) {
			for (let x = 0; x < width; x++) {
				const first = this.get(x, y);
				const second = y + 1 >= height ? true : this.get(x, y + 1);
				if (!first && !second) out += "█";
				else if (!first && second) out += "▀";
				else if (first && !second) out += "▄";
				else if (first && second) out += " ";
			}
			out += String.fromCharCode(chCodes.newline);
		}
		return out;
	}
	toTerm() {
		const cc = String.fromCharCode(chCodes.reset);
		const reset = cc + "[0m";
		const whiteBG = cc + "[1;47m  " + reset;
		const darkBG = cc + `[40m  ` + reset;
		const nl = String.fromCharCode(chCodes.newline);
		let out = "";
		for (let y = 0; y < this.height; y++) {
			for (let x = 0; x < this.width; x++) {
				const v = this.get(x, y);
				out += v ? darkBG : whiteBG;
			}
			out += nl;
		}
		return out;
	}
	toSVG(optimize = true) {
		let out = `<svg viewBox="0 0 ${this.width} ${this.height}" xmlns="http://www.w3.org/2000/svg">`;
		let pathData = "";
		let prevPoint;
		this.rectRead(0, Infinity, (point, val) => {
			if (!val) return;
			const { x, y } = point;
			if (!optimize) {
				out += `<rect x="${x}" y="${y}" width="1" height="1" />`;
				return;
			}
			let m = `M${x} ${y}`;
			if (prevPoint) {
				const relM = `m${x - prevPoint.x} ${y - prevPoint.y}`;
				if (relM.length <= m.length) m = relM;
			}
			const bH = x < 10 ? `H${x}` : "h-1";
			pathData += `${m}h1v1${bH}Z`;
			prevPoint = point;
		});
		if (optimize) out += `<path d="${pathData}"/>`;
		out += `</svg>`;
		return out;
	}
	toGIF() {
		const u16le = (i) => [i & 255, i >>> 8 & 255];
		const dims = [...u16le(this.width), ...u16le(this.height)];
		const data = [];
		this.rectRead(0, Infinity, (_, cur) => data.push(+(cur === true)));
		const N = 126;
		const bytes = [
			71,
			73,
			70,
			56,
			55,
			97,
			...dims,
			246,
			0,
			0,
			255,
			255,
			255,
			...fillArr(381, 0),
			44,
			0,
			0,
			0,
			0,
			...dims,
			0,
			7
		];
		const fullChunks = Math.floor(data.length / N);
		for (let i = 0; i < fullChunks; i++) bytes.push(127, 128, ...data.slice(N * i, N * (i + 1)).map((i) => +i));
		bytes.push(data.length % N + 1, 128, ...data.slice(fullChunks * N).map((i) => +i));
		bytes.push(1, 129, 0, 59);
		return new Uint8Array(bytes);
	}
	toImage(isRGB = false) {
		const { height, width } = this.size();
		const data = new Uint8Array(height * width * (isRGB ? 3 : 4));
		let i = 0;
		for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
			const value = this.get(x, y) ? 0 : 255;
			data[i++] = value;
			data[i++] = value;
			data[i++] = value;
			if (!isRGB) data[i++] = 255;
		}
		return {
			height,
			width,
			data
		};
	}
};
/** Error correction mode. low: 7%, medium: 15%, quartile: 25%, high: 30%. */
var ECMode = /* @__PURE__ */ Object.freeze([
	"low",
	"medium",
	"quartile",
	"high"
]);
/**
* QR payload compaction mode names recognized by the type/validator.
* `kanji` and `eci` are spec modes, but `encodeQR` currently rejects them until implemented.
*/
var Encoding = /* @__PURE__ */ Object.freeze([
	"numeric",
	"alphanumeric",
	"byte",
	"kanji",
	"eci"
]);
var BYTES = [
	26,
	44,
	70,
	100,
	134,
	172,
	196,
	242,
	292,
	346,
	404,
	466,
	532,
	581,
	655,
	733,
	815,
	901,
	991,
	1085,
	1156,
	1258,
	1364,
	1474,
	1588,
	1706,
	1828,
	1921,
	2051,
	2185,
	2323,
	2465,
	2611,
	2761,
	2876,
	3034,
	3196,
	3362,
	3532,
	3706
];
var WORDS_PER_BLOCK = {
	low: [
		7,
		10,
		15,
		20,
		26,
		18,
		20,
		24,
		30,
		18,
		20,
		24,
		26,
		30,
		22,
		24,
		28,
		30,
		28,
		28,
		28,
		28,
		30,
		30,
		26,
		28,
		30,
		30,
		30,
		30,
		30,
		30,
		30,
		30,
		30,
		30,
		30,
		30,
		30,
		30
	],
	medium: [
		10,
		16,
		26,
		18,
		24,
		16,
		18,
		22,
		22,
		26,
		30,
		22,
		22,
		24,
		24,
		28,
		28,
		26,
		26,
		26,
		26,
		28,
		28,
		28,
		28,
		28,
		28,
		28,
		28,
		28,
		28,
		28,
		28,
		28,
		28,
		28,
		28,
		28,
		28,
		28
	],
	quartile: [
		13,
		22,
		18,
		26,
		18,
		24,
		18,
		22,
		20,
		24,
		28,
		26,
		24,
		20,
		30,
		24,
		28,
		28,
		26,
		30,
		28,
		30,
		30,
		30,
		30,
		28,
		30,
		30,
		30,
		30,
		30,
		30,
		30,
		30,
		30,
		30,
		30,
		30,
		30,
		30
	],
	high: [
		17,
		28,
		22,
		16,
		22,
		28,
		26,
		26,
		24,
		28,
		24,
		28,
		22,
		24,
		24,
		30,
		28,
		28,
		26,
		28,
		30,
		24,
		30,
		30,
		30,
		30,
		30,
		30,
		30,
		30,
		30,
		30,
		30,
		30,
		30,
		30,
		30,
		30,
		30,
		30
	]
};
var ECC_BLOCKS = {
	low: [
		1,
		1,
		1,
		1,
		1,
		2,
		2,
		2,
		2,
		4,
		4,
		4,
		4,
		4,
		6,
		6,
		6,
		6,
		7,
		8,
		8,
		9,
		9,
		10,
		12,
		12,
		12,
		13,
		14,
		15,
		16,
		17,
		18,
		19,
		19,
		20,
		21,
		22,
		24,
		25
	],
	medium: [
		1,
		1,
		1,
		2,
		2,
		4,
		4,
		4,
		5,
		5,
		5,
		8,
		9,
		9,
		10,
		10,
		11,
		13,
		14,
		16,
		17,
		17,
		18,
		20,
		21,
		23,
		25,
		26,
		28,
		29,
		31,
		33,
		35,
		37,
		38,
		40,
		43,
		45,
		47,
		49
	],
	quartile: [
		1,
		1,
		2,
		2,
		4,
		4,
		6,
		6,
		8,
		8,
		8,
		10,
		12,
		16,
		12,
		17,
		16,
		18,
		21,
		20,
		23,
		23,
		25,
		27,
		29,
		34,
		34,
		35,
		38,
		40,
		43,
		45,
		48,
		51,
		53,
		56,
		59,
		62,
		65,
		68
	],
	high: [
		1,
		1,
		2,
		4,
		4,
		4,
		5,
		6,
		8,
		8,
		11,
		11,
		16,
		16,
		18,
		16,
		19,
		21,
		25,
		25,
		25,
		34,
		30,
		32,
		35,
		37,
		40,
		42,
		45,
		48,
		51,
		54,
		57,
		60,
		63,
		66,
		70,
		74,
		77,
		81
	]
};
var info = /* @__PURE__ */ Object.freeze({
	size: /* @__PURE__ */ Object.freeze({
		encode: (ver) => 21 + 4 * (ver - 1),
		decode: (size) => (size - 17) / 4
	}),
	sizeType: (ver) => Math.floor((ver + 7) / 17),
	alignmentPatterns(ver) {
		if (ver === 1) return [];
		const first = 6;
		const last = info.size.encode(ver) - first - 1;
		const distance = last - first;
		const count = Math.ceil(distance / 28);
		let interval = Math.floor(distance / count);
		if (interval % 2) interval += 1;
		else if (distance % count * 2 >= count) interval += 2;
		const res = [first];
		for (let m = 1; m < count; m++) res.push(last - (count - m) * interval);
		res.push(last);
		return res;
	},
	ECCode: /* @__PURE__ */ Object.freeze({
		low: 1,
		medium: 0,
		quartile: 3,
		high: 2
	}),
	formatMask: 21522,
	formatBits(ecc, maskIdx) {
		const data = info.ECCode[ecc] << 3 | maskIdx;
		let d = data;
		for (let i = 0; i < 10; i++) d = d << 1 ^ (d >> 9) * 1335;
		return (data << 10 | d) ^ info.formatMask;
	},
	versionBits(ver) {
		let d = ver;
		for (let i = 0; i < 12; i++) d = d << 1 ^ (d >> 11) * 7973;
		return ver << 12 | d;
	},
	alphabet: /* @__PURE__ */ Object.freeze({
		numeric: alphabet("0123456789"),
		alphanumerc: alphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:")
	}),
	lengthBits(ver, type) {
		return {
			numeric: [
				10,
				12,
				14
			],
			alphanumeric: [
				9,
				11,
				13
			],
			byte: [
				8,
				16,
				16
			],
			kanji: [
				8,
				10,
				12
			],
			eci: [
				0,
				0,
				0
			]
		}[type][info.sizeType(ver)];
	},
	modeBits: /* @__PURE__ */ Object.freeze({
		numeric: "0001",
		alphanumeric: "0010",
		byte: "0100",
		kanji: "1000",
		eci: "0111"
	}),
	capacity(ver, ecc) {
		const bytes = BYTES[ver - 1];
		const words = WORDS_PER_BLOCK[ecc][ver - 1];
		const numBlocks = ECC_BLOCKS[ecc][ver - 1];
		const blockLen = Math.floor(bytes / numBlocks) - words;
		const shortBlocks = numBlocks - bytes % numBlocks;
		return {
			words,
			numBlocks,
			shortBlocks,
			blockLen,
			capacity: (bytes - words * numBlocks) * 8,
			total: (words + blockLen) * numBlocks + numBlocks - shortBlocks
		};
	}
});
var PATTERNS = /* @__PURE__ */ Object.freeze([
	(x, y) => (x + y) % 2 == 0,
	(_x, y) => y % 2 == 0,
	(x, _y) => x % 3 == 0,
	(x, y) => (x + y) % 3 == 0,
	(x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 == 0,
	(x, y) => x * y % 2 + x * y % 3 == 0,
	(x, y) => (x * y % 2 + x * y % 3) % 2 == 0,
	(x, y) => ((x + y) % 2 + x * y % 3) % 2 == 0
]);
var GF = {
	tables: ((p_poly) => {
		const exp = fillArr(256, 0);
		const log = fillArr(256, 0);
		for (let i = 0, x = 1; i < 256; i++) {
			exp[i] = x;
			log[x] = i;
			x <<= 1;
			if (x & 256) x ^= p_poly;
		}
		return {
			exp,
			log
		};
	})(285),
	exp: (x) => GF.tables.exp[x],
	log(x) {
		if (x === 0) throw new Error(`GF.log: invalid arg=${x}`);
		return GF.tables.log[x] % 255;
	},
	mul(x, y) {
		if (x === 0 || y === 0) return 0;
		return GF.tables.exp[(GF.tables.log[x] + GF.tables.log[y]) % 255];
	},
	add: (x, y) => x ^ y,
	pow: (x, e) => GF.tables.exp[GF.tables.log[x] * e % 255],
	inv(x) {
		if (x === 0) throw new Error(`GF.inverse: invalid arg=${x}`);
		return GF.tables.exp[255 - GF.tables.log[x]];
	},
	polynomial(poly) {
		if (poly.length == 0) throw new Error("GF.polymomial: invalid length");
		if (poly[0] !== 0) return poly;
		let i = 0;
		for (; i < poly.length - 1 && poly[i] == 0; i++);
		return poly.slice(i);
	},
	monomial(degree, coefficient) {
		if (degree < 0) throw new Error(`GF.monomial: invalid degree=${degree}`);
		if (coefficient == 0) return [0];
		let coefficients = fillArr(degree + 1, 0);
		coefficients[0] = coefficient;
		return GF.polynomial(coefficients);
	},
	degree: (a) => a.length - 1,
	coefficient: (a, degree) => a[GF.degree(a) - degree],
	mulPoly(a, b) {
		if (a[0] === 0 || b[0] === 0) return [0];
		const res = fillArr(a.length + b.length - 1, 0);
		for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) res[i + j] = GF.add(res[i + j], GF.mul(a[i], b[j]));
		return GF.polynomial(res);
	},
	mulPolyScalar(a, scalar) {
		if (scalar == 0) return [0];
		if (scalar == 1) return a;
		const res = fillArr(a.length, 0);
		for (let i = 0; i < a.length; i++) res[i] = GF.mul(a[i], scalar);
		return GF.polynomial(res);
	},
	mulPolyMonomial(a, degree, coefficient) {
		if (degree < 0) throw new Error("GF.mulPolyMonomial: invalid degree");
		if (coefficient == 0) return [0];
		const res = fillArr(a.length + degree, 0);
		for (let i = 0; i < a.length; i++) res[i] = GF.mul(a[i], coefficient);
		return GF.polynomial(res);
	},
	addPoly(a, b) {
		if (a[0] === 0) return b;
		if (b[0] === 0) return a;
		let smaller = a;
		let larger = b;
		if (smaller.length > larger.length) [smaller, larger] = [larger, smaller];
		let sumDiff = fillArr(larger.length, 0);
		let lengthDiff = larger.length - smaller.length;
		let s = larger.slice(0, lengthDiff);
		for (let i = 0; i < s.length; i++) sumDiff[i] = s[i];
		for (let i = lengthDiff; i < larger.length; i++) sumDiff[i] = GF.add(smaller[i - lengthDiff], larger[i]);
		return GF.polynomial(sumDiff);
	},
	remainderPoly(data, divisor) {
		const out = Array.from(data);
		for (let i = 0; i < data.length - divisor.length + 1; i++) {
			const elm = out[i];
			if (elm === 0) continue;
			for (let j = 1; j < divisor.length; j++) if (divisor[j] !== 0) out[i + j] = GF.add(out[i + j], GF.mul(divisor[j], elm));
		}
		return out.slice(data.length - divisor.length + 1, out.length);
	},
	divisorPoly(degree) {
		let g = [1];
		for (let i = 0; i < degree; i++) g = GF.mulPoly(g, [1, GF.pow(2, i)]);
		return g;
	},
	evalPoly(poly, a) {
		if (a == 0) return GF.coefficient(poly, 0);
		let res = poly[0];
		for (let i = 1; i < poly.length; i++) res = GF.add(GF.mul(a, res), poly[i]);
		return res;
	},
	euclidian(a, b, R) {
		if (GF.degree(a) < GF.degree(b)) [a, b] = [b, a];
		let rLast = a;
		let r = b;
		let tLast = [0];
		let t = [1];
		while (2 * GF.degree(r) >= R) {
			let rLastLast = rLast;
			let tLastLast = tLast;
			rLast = r;
			tLast = t;
			if (rLast[0] === 0) throw new Error("rLast[0] === 0");
			r = rLastLast;
			let q = [0];
			const dltInverse = GF.inv(rLast[0]);
			while (GF.degree(r) >= GF.degree(rLast) && r[0] !== 0) {
				const degreeDiff = GF.degree(r) - GF.degree(rLast);
				const scale = GF.mul(r[0], dltInverse);
				q = GF.addPoly(q, GF.monomial(degreeDiff, scale));
				r = GF.addPoly(r, GF.mulPolyMonomial(rLast, degreeDiff, scale));
			}
			q = GF.mulPoly(q, tLast);
			t = GF.addPoly(q, tLastLast);
			if (GF.degree(r) >= GF.degree(rLast)) throw new Error(`Division failed r: ${r}, rLast: ${rLast}`);
		}
		const sigmaTildeAtZero = GF.coefficient(t, 0);
		if (sigmaTildeAtZero == 0) throw new Error("sigmaTilde(0) was zero");
		const inverse = GF.inv(sigmaTildeAtZero);
		return [GF.mulPolyScalar(t, inverse), GF.mulPolyScalar(r, inverse)];
	}
};
function RS(eccWords) {
	return {
		encode(from) {
			const d = GF.divisorPoly(eccWords);
			const pol = Array.from(from);
			pol.push(...d.slice(0, -1).fill(0));
			return Uint8Array.from(GF.remainderPoly(pol, d));
		},
		decode(to) {
			const res = to.slice();
			const poly = GF.polynomial(Array.from(to));
			let syndrome = fillArr(eccWords, 0);
			let hasError = false;
			for (let i = 0; i < eccWords; i++) {
				const evl = GF.evalPoly(poly, GF.exp(i));
				syndrome[syndrome.length - 1 - i] = evl;
				if (evl !== 0) hasError = true;
			}
			if (!hasError) return res;
			syndrome = GF.polynomial(syndrome);
			const monomial = GF.monomial(eccWords, 1);
			const [errorLocator, errorEvaluator] = GF.euclidian(monomial, syndrome, eccWords);
			const locations = fillArr(GF.degree(errorLocator), 0);
			let e = 0;
			for (let i = 1; i < 256 && e < locations.length; i++) if (GF.evalPoly(errorLocator, i) === 0) locations[e++] = GF.inv(i);
			if (e !== locations.length) throw new Error("RS.decode: invalid errors number");
			for (let i = 0; i < locations.length; i++) {
				const pos = res.length - 1 - GF.log(locations[i]);
				if (pos < 0) throw new Error("RS.decode: invalid error location");
				const xiInverse = GF.inv(locations[i]);
				let denominator = 1;
				for (let j = 0; j < locations.length; j++) {
					if (i === j) continue;
					denominator = GF.mul(denominator, GF.add(1, GF.mul(locations[j], xiInverse)));
				}
				res[pos] = GF.add(res[pos], GF.mul(GF.evalPoly(errorEvaluator, xiInverse), GF.inv(denominator)));
			}
			return res;
		}
	};
}
function interleave(ver, ecc) {
	const { words, shortBlocks, numBlocks, blockLen, total } = info.capacity(ver, ecc);
	const rs = RS(words);
	return {
		encode(bytes) {
			const blocks = [];
			const eccBlocks = [];
			for (let i = 0; i < numBlocks; i++) {
				const len = blockLen + (i < shortBlocks ? 0 : 1);
				blocks.push(bytes.subarray(0, len));
				eccBlocks.push(rs.encode(bytes.subarray(0, len)));
				bytes = bytes.subarray(len);
			}
			const resBlocks = interleaveBytes(blocks);
			const resECC = interleaveBytes(eccBlocks);
			const res = new Uint8Array(resBlocks.length + resECC.length);
			res.set(resBlocks);
			res.set(resECC, resBlocks.length);
			return res;
		},
		decode(data) {
			if (data.length !== total) throw new Error(`interleave.decode: len(data)=${data.length}, total=${total}`);
			const blocks = [];
			for (let i = 0; i < numBlocks; i++) {
				const isShort = i < shortBlocks;
				blocks.push(new Uint8Array(words + blockLen + (isShort ? 0 : 1)));
			}
			let pos = 0;
			for (let i = 0; i < blockLen; i++) for (let j = 0; j < numBlocks; j++) blocks[j][i] = data[pos++];
			for (let j = shortBlocks; j < numBlocks; j++) blocks[j][blockLen] = data[pos++];
			for (let i = blockLen; i < blockLen + words; i++) for (let j = 0; j < numBlocks; j++) {
				const isShort = j < shortBlocks;
				blocks[j][i + (isShort ? 0 : 1)] = data[pos++];
			}
			const res = [];
			for (const block of blocks) res.push(...Array.from(rs.decode(block)).slice(0, -words));
			return Uint8Array.from(res);
		}
	};
}
function drawTemplate(ver, ecc, maskIdx, test = false) {
	const size = info.size.encode(ver);
	let b = new Bitmap(size + 2);
	const finder = new Bitmap(3).rect(0, 3, true).border(1, false).border(1, true).border(1, false);
	b = b.embed(0, finder).embed({
		x: -finder.width,
		y: 0
	}, finder).embed({
		x: 0,
		y: -finder.height
	}, finder);
	b = b.rectSlice(1, size);
	const align = new Bitmap(1).rect(0, 1, true).border(1, false).border(1, true);
	const alignPos = info.alignmentPatterns(ver);
	for (const y of alignPos) for (const x of alignPos) {
		if (b.isDefined(x, y)) continue;
		b.embed({
			x: x - 2,
			y: y - 2
		}, align);
	}
	b = b.hLine({
		x: 0,
		y: 6
	}, Infinity, ({ x }) => b.isDefined(x, 6) ? void 0 : x % 2 == 0).vLine({
		x: 6,
		y: 0
	}, Infinity, ({ y }) => b.isDefined(6, y) ? void 0 : y % 2 == 0);
	{
		const bits = info.formatBits(ecc, maskIdx);
		const getBit = (i) => !test && (bits >> i & 1) == 1;
		for (let i = 0; i < 6; i++) b.set(8, i, getBit(i));
		for (let i = 6; i < 8; i++) b.set(8, i + 1, getBit(i));
		for (let i = 8; i < 15; i++) b.set(8, size - 15 + i, getBit(i));
		for (let i = 0; i < 8; i++) b.set(size - i - 1, 8, getBit(i));
		for (let i = 8; i < 9; i++) b.set(15 - i - 1 + 1, 8, getBit(i));
		for (let i = 9; i < 15; i++) b.set(15 - i - 1, 8, getBit(i));
		b.set(8, size - 8, !test);
	}
	if (ver >= 7) {
		const bits = info.versionBits(ver);
		for (let i = 0; i < 18; i += 1) {
			const bit = !test && (bits >> i & 1) == 1;
			const x = Math.floor(i / 3);
			const y = i % 3 + size - 8 - 3;
			b.set(y, x, bit);
			b.set(x, y, bit);
		}
	}
	return b;
}
function zigzag(tpl, maskIdx, fn) {
	const bm = tpl;
	const size = bm.height;
	const pattern = PATTERNS[maskIdx];
	let dir = -1;
	let y = size - 1;
	for (let xOffset = size - 1; xOffset > 0; xOffset -= 2) {
		if (xOffset == 6) xOffset = 5;
		for (;; y += dir) {
			for (let j = 0; j < 2; j += 1) {
				const x = xOffset - j;
				if (bm.isDefined(x, y)) continue;
				fn(x, y, pattern(x, y));
			}
			if (y + dir < 0 || y + dir >= size) break;
		}
		dir = -dir;
	}
}
function detectType(str) {
	let type = "numeric";
	for (let x of str) {
		if (info.alphabet.numeric.has(x)) continue;
		type = "alphanumeric";
		if (!info.alphabet.alphanumerc.has(x)) return "byte";
	}
	return type;
}
/**
* Encode a string as UTF-8 bytes.
* @param str - Text to encode into UTF-8.
* @returns UTF-8 bytes for the provided string.
* @throws If the input is not a string. {@link Error}
* @example
* Encode a string as UTF-8 bytes.
* ```ts
* const bytes = utf8ToBytes('abc'); // new Uint8Array([97, 98, 99])
* ```
*/
function utf8ToBytes(str) {
	if (typeof str !== "string") throw new Error(`utf8ToBytes expected string, got ${typeof str}`);
	return new Uint8Array(new TextEncoder().encode(str));
}
function encode(ver, ecc, data, type, encoder = utf8ToBytes) {
	let encoded = "";
	let dataLen = data.length;
	if (type === "numeric") {
		const t = info.alphabet.numeric.decode(data.split(""));
		const n = t.length;
		for (let i = 0; i < n - 2; i += 3) encoded += bin(t[i] * 100 + t[i + 1] * 10 + t[i + 2], 10);
		if (n % 3 === 1) encoded += bin(t[n - 1], 4);
		else if (n % 3 === 2) encoded += bin(t[n - 2] * 10 + t[n - 1], 7);
	} else if (type === "alphanumeric") {
		const t = info.alphabet.alphanumerc.decode(data.split(""));
		const n = t.length;
		for (let i = 0; i < n - 1; i += 2) encoded += bin(t[i] * 45 + t[i + 1], 11);
		if (n % 2 == 1) encoded += bin(t[n - 1], 6);
	} else if (type === "byte") {
		const utf8 = encoder(data);
		dataLen = utf8.length;
		encoded = Array.from(utf8).map((i) => bin(i, 8)).join("");
	} else throw new Error("encode: unsupported type");
	const { capacity } = info.capacity(ver, ecc);
	const len = bin(dataLen, info.lengthBits(ver, type));
	let bits = info.modeBits[type] + len + encoded;
	if (bits.length > capacity) throw new Error("Capacity overflow");
	bits += "0".repeat(Math.min(4, Math.max(0, capacity - bits.length)));
	if (bits.length % 8) bits += "0".repeat(8 - bits.length % 8);
	const padding = "1110110000010001";
	for (let idx = 0; bits.length !== capacity; idx++) bits += padding[idx % 16];
	const bytes = Uint8Array.from(bits.match(/(.{8})/g).map((i) => Number(`0b${i}`)));
	return interleave(ver, ecc).encode(bytes);
}
function drawQR(ver, ecc, data, maskIdx, test = false) {
	const b = drawTemplate(ver, ecc, maskIdx, test);
	let i = 0;
	const need = 8 * data.length;
	zigzag(b, maskIdx, (x, y, mask) => {
		let value = false;
		if (i < need) {
			value = (data[i >>> 3] >> (7 - i & 7) & 1) !== 0;
			i++;
		}
		b.set(x, y, value !== mask);
	});
	if (i !== need) throw new Error("QR: bytes left after draw");
	return b;
}
var mkPattern = (pattern) => {
	const s = pattern.map((i) => i ? "1" : "0").join("");
	return {
		len: s.length,
		n: Number(`0b${s}`)
	};
};
var finderPattern = [
	true,
	false,
	true,
	true,
	true,
	false,
	true
];
var lightPattern = [
	false,
	false,
	false,
	false
];
var P1 = /* @__PURE__ */ (() => mkPattern([...finderPattern, ...lightPattern]))();
var P2 = /* @__PURE__ */ (() => mkPattern([...lightPattern, ...finderPattern]))();
function penalty(bm) {
	const b = bm;
	const { width, height } = b;
	const transposed = b.transpose();
	let adjacent = 0;
	for (let y = 0; y < height; y++) b.getRuns(y, (len) => {
		if (len >= 5) adjacent += 3 + (len - 5);
	});
	for (let y = 0; y < width; y++) transposed.getRuns(y, (len) => {
		if (len >= 5) adjacent += 3 + (len - 5);
	});
	let box = 0;
	for (let y = 0; y < height - 1; y++) box += 3 * b.countBoxes2x2(y);
	let finder = 0;
	for (let y = 0; y < height; y++) finder += 40 * b.countPatternInRow(y, P1.len, P1.n, P2.n);
	for (let y = 0; y < width; y++) finder += 40 * transposed.countPatternInRow(y, P1.len, P1.n, P2.n);
	const total = height * width;
	const darkPixels = b.popcnt();
	const dark = 10 * Math.ceil(Math.max(0, Math.abs(darkPixels * 100 - total * 50) - total * 5) / (total * 5));
	return adjacent + box + finder + dark;
}
function drawQRBest(ver, ecc, data, maskIdx) {
	if (maskIdx === void 0) {
		const bestMask = best();
		for (let mask = 0; mask < PATTERNS.length; mask++) bestMask.add(penalty(drawQR(ver, ecc, data, mask, true)), mask);
		maskIdx = bestMask.get();
	}
	if (maskIdx === void 0) throw new Error("Cannot find mask");
	return drawQR(ver, ecc, data, maskIdx);
}
function validateECC(ec) {
	if (!ECMode.includes(ec)) throw new Error(`Invalid error correction mode=${ec}. Expected: ${ECMode}`);
}
function validateEncoding(enc) {
	if (!Encoding.includes(enc)) throw new Error(`Encoding: invalid mode=${enc}. Expected: ${Encoding}`);
	if (enc === "kanji" || enc === "eci") throw new Error(`Encoding: ${enc} is not supported (yet?).`);
}
function validateMask(mask) {
	if (![
		0,
		1,
		2,
		3,
		4,
		5,
		6,
		7
	].includes(mask) || !PATTERNS[mask]) throw new Error(`Invalid mask=${mask}. Expected number [0..7]`);
}
function encodeQR(text, output = "raw", opts = {}) {
	const _opts = opts;
	const ecc = _opts.ecc !== void 0 ? _opts.ecc : "medium";
	validateECC(ecc);
	const encoding = _opts.encoding !== void 0 ? _opts.encoding : detectType(text);
	validateEncoding(encoding);
	if (_opts.mask !== void 0) validateMask(_opts.mask);
	let ver = _opts.version;
	let data, err = /* @__PURE__ */ new Error("Unknown error");
	if (ver !== void 0) {
		validateVersion(ver);
		data = encode(ver, ecc, text, encoding, _opts.textEncoder);
	} else for (let i = 1; i <= 40; i++) try {
		data = encode(i, ecc, text, encoding, _opts.textEncoder);
		ver = i;
		break;
	} catch (e) {
		err = e;
	}
	if (!ver || !data) throw err;
	let res = drawQRBest(ver, ecc, data, _opts.mask);
	res.assertDrawn();
	const border = _opts.border === void 0 ? 2 : _opts.border;
	if (!Number.isSafeInteger(border) || border <= 0) throw new Error(`invalid border=${border}`);
	res = res.border(border, false);
	if (_opts.scale !== void 0) res = res.scale(_opts.scale);
	if (output === "raw") return res.toRaw();
	else if (output === "ascii") return res.toASCII();
	else if (output === "svg") return res.toSVG(_opts.optimize);
	else if (output === "gif") return res.toGIF();
	else if (output === "term") return res.toTerm();
	else throw new Error(`Unknown output: ${output}`);
}
//#endregion
//#region node_modules/cuer/_dist/QrCode.js
function create(value, options = {}) {
	const { errorCorrection, version } = options;
	const grid = encodeQR(value, "raw", {
		border: 0,
		ecc: errorCorrection,
		scale: 1,
		version
	});
	return {
		edgeLength: grid.length,
		finderLength: 7,
		grid,
		value
	};
}
//#endregion
//#region node_modules/cuer/_dist/Cuer.js
/**
* Renders a QR code with a finder pattern, cells, and an `arena` (if provided).
*
* @params {@link Cuer.Props}
* @returns A {@link React.ReactNode}
*/
function Cuer(props) {
	const { arena, ...rest } = props;
	return (0, import_jsx_runtime.jsxs)(Cuer.Root, {
		...rest,
		children: [
			(0, import_jsx_runtime.jsx)(Cuer.Finder, {}),
			(0, import_jsx_runtime.jsx)(Cuer.Cells, {}),
			arena && (0, import_jsx_runtime.jsx)(Cuer.Arena, { children: typeof arena === "string" ? (0, import_jsx_runtime.jsx)("img", {
				alt: "Arena",
				src: arena,
				style: {
					borderRadius: 1,
					height: "100%",
					objectFit: "cover",
					width: "100%"
				}
			}) : arena })
		]
	});
}
(function(Cuer) {
	Cuer.Context = import_react.createContext(null);
	/**
	* Root component for the QR code.
	*
	* @params {@link Root.Props}
	* @returns A {@link React.ReactNode}
	*/
	function Root(props) {
		const { children, size = "100%", value, version, errorCorrection, ...rest } = props;
		const hasArena = import_react.useMemo(() => (import_react.Children.map(children, (child) => {
			if (!import_react.isValidElement(child)) return null;
			if (typeof child.type === "string") return null;
			if ("displayName" in child.type && child.type.displayName === "Arena") return true;
			return null;
		}) ?? []).some(Boolean), [children]);
		const qrcode = import_react.useMemo(() => {
			let ecl = errorCorrection;
			if (hasArena && errorCorrection === "low") ecl = "medium";
			return create(value, {
				errorCorrection: ecl,
				version
			});
		}, [
			value,
			hasArena,
			errorCorrection,
			version
		]);
		const cellSize = 1;
		const edgeSize = qrcode.edgeLength * cellSize;
		const finderSize = qrcode.finderLength * cellSize / 2;
		const arenaSize = hasArena ? Math.floor(edgeSize / 4) : 0;
		const context = import_react.useMemo(() => ({
			arenaSize,
			cellSize,
			edgeSize,
			qrcode,
			finderSize
		}), [
			arenaSize,
			edgeSize,
			qrcode,
			finderSize
		]);
		return (0, import_jsx_runtime.jsx)(Cuer.Context.Provider, {
			value: context,
			children: (0, import_jsx_runtime.jsxs)("svg", {
				...rest,
				width: size,
				height: size,
				viewBox: `0 0 ${edgeSize} ${edgeSize}`,
				xmlns: "http://www.w3.org/2000/svg",
				children: [(0, import_jsx_runtime.jsx)("title", { children: "QR Code" }), children]
			})
		});
	}
	Cuer.Root = Root;
	(function(Root) {
		Root.displayName = "Root";
	})(Root = Cuer.Root || (Cuer.Root = {}));
	/**
	* Finder component for the QR code. The finder pattern is the squares
	* on the top left, top right, and bottom left of the QR code.
	*
	* @params {@link Finder.Props}
	* @returns A {@link React.ReactNode}
	*/
	function Finder(props) {
		const { className, fill, innerClassName, radius = .25 } = props;
		const { cellSize, edgeSize, finderSize } = import_react.useContext(Cuer.Context);
		function Inner({ position }) {
			let outerX = finderSize - (finderSize - cellSize) - cellSize / 2;
			if (position === "top-right") outerX = edgeSize - finderSize - (finderSize - cellSize) - cellSize / 2;
			let outerY = finderSize - (finderSize - cellSize) - cellSize / 2;
			if (position === "bottom-left") outerY = edgeSize - finderSize - (finderSize - cellSize) - cellSize / 2;
			let innerX = finderSize - cellSize * 1.5;
			if (position === "top-right") innerX = edgeSize - finderSize - cellSize * 1.5;
			let innerY = finderSize - cellSize * 1.5;
			if (position === "bottom-left") innerY = edgeSize - finderSize - cellSize * 1.5;
			return (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [(0, import_jsx_runtime.jsx)("rect", {
				className,
				stroke: fill ?? "currentColor",
				fill: "transparent",
				x: outerX,
				y: outerY,
				width: cellSize + (finderSize - cellSize) * 2,
				height: cellSize + (finderSize - cellSize) * 2,
				rx: 2 * radius * (finderSize - cellSize),
				ry: 2 * radius * (finderSize - cellSize),
				strokeWidth: cellSize
			}), (0, import_jsx_runtime.jsx)("rect", {
				className: innerClassName,
				fill: fill ?? "currentColor",
				x: innerX,
				y: innerY,
				width: cellSize * 3,
				height: cellSize * 3,
				rx: 2 * radius * cellSize,
				ry: 2 * radius * cellSize
			})] });
		}
		return (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			(0, import_jsx_runtime.jsx)(Inner, { position: "top-left" }),
			(0, import_jsx_runtime.jsx)(Inner, { position: "top-right" }),
			(0, import_jsx_runtime.jsx)(Inner, { position: "bottom-left" })
		] });
	}
	Cuer.Finder = Finder;
	(function(Finder) {
		Finder.displayName = "Finder";
	})(Finder = Cuer.Finder || (Cuer.Finder = {}));
	/**
	* Cells for the QR code.
	*
	* @params {@link Cells.Props}
	* @returns A {@link React.ReactNode}
	*/
	function Cells(props) {
		const { className, fill = "currentColor", inset: inset_ = true, radius = 1 } = props;
		const { arenaSize, cellSize, qrcode } = import_react.useContext(Cuer.Context);
		const { edgeLength, finderLength } = qrcode;
		return (0, import_jsx_runtime.jsx)("path", {
			className,
			d: import_react.useMemo(() => {
				let path = "";
				for (let i = 0; i < qrcode.grid.length; i++) {
					const row = qrcode.grid[i];
					if (!row) continue;
					for (let j = 0; j < row.length; j++) {
						if (!row[j]) continue;
						const start = edgeLength / 2 - arenaSize / 2;
						const end = start + arenaSize;
						if (i >= start && i <= end && j >= start && j <= end) continue;
						const topLeftFinder = i < finderLength && j < finderLength;
						const topRightFinder = i < finderLength && j >= edgeLength - finderLength;
						const bottomLeftFinder = i >= edgeLength - finderLength && j < finderLength;
						if (topLeftFinder || topRightFinder || bottomLeftFinder) continue;
						const innerSize = (cellSize - (inset_ ? cellSize * .1 : 0) * 2) / 2;
						const cx = j * cellSize + cellSize / 2;
						const cy = i * cellSize + cellSize / 2;
						const left = cx - innerSize;
						const right = cx + innerSize;
						const top = cy - innerSize;
						const bottom = cy + innerSize;
						const r = radius * innerSize;
						path += [
							`M ${left + r},${top}`,
							`L ${right - r},${top}`,
							`A ${r},${r} 0 0,1 ${right},${top + r}`,
							`L ${right},${bottom - r}`,
							`A ${r},${r} 0 0,1 ${right - r},${bottom}`,
							`L ${left + r},${bottom}`,
							`A ${r},${r} 0 0,1 ${left},${bottom - r}`,
							`L ${left},${top + r}`,
							`A ${r},${r} 0 0,1 ${left + r},${top}`,
							"z"
						].join(" ");
					}
				}
				return path;
			}, [
				arenaSize,
				cellSize,
				edgeLength,
				finderLength,
				qrcode.grid,
				inset_,
				radius
			]),
			fill
		});
	}
	Cuer.Cells = Cells;
	(function(Cells) {
		Cells.displayName = "Cells";
	})(Cells = Cuer.Cells || (Cuer.Cells = {}));
	/**
	* Arena component for the QR code. The arena is the area in the center
	* of the QR code that is not part of the finder pattern.
	*
	* @params {@link Arena.Props}
	* @returns A {@link React.ReactNode}
	*/
	function Arena(props) {
		const { children } = props;
		const { arenaSize, cellSize, edgeSize } = import_react.useContext(Cuer.Context);
		const start = Math.ceil(edgeSize / 2 - arenaSize / 2);
		const size = arenaSize + arenaSize % 2;
		return (0, import_jsx_runtime.jsx)("foreignObject", {
			x: start,
			y: start,
			width: size,
			height: size,
			children: (0, import_jsx_runtime.jsx)("div", {
				style: {
					alignItems: "center",
					display: "flex",
					fontSize: 1,
					justifyContent: "center",
					height: "100%",
					overflow: "hidden",
					width: "100%",
					padding: cellSize / 2,
					boxSizing: "border-box"
				},
				children
			})
		});
	}
	Cuer.Arena = Arena;
	(function(Arena) {
		Arena.displayName = "Arena";
	})(Arena = Cuer.Arena || (Cuer.Arena = {}));
})(Cuer || (Cuer = {}));
//#endregion
//#region node_modules/@trustwallet/connect-react/dist/index.js
function MobileEmptyState({ searchQuery }) {
	if (searchQuery) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: styles.empty,
		children: [
			"No wallets found for \"",
			searchQuery,
			"\""
		]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: styles.empty,
		children: "No wallets available"
	});
}
function MobileLoading() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: styles2.loading,
		children: "Loading wallets..."
	});
}
function SearchIcon() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "16",
		height: "16",
		viewBox: "0 0 16 16",
		fill: "none",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			d: "M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z",
			stroke: "currentColor",
			strokeWidth: "1.5",
			strokeLinecap: "round",
			strokeLinejoin: "round"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			d: "M14 14L11.1 11.1",
			stroke: "currentColor",
			strokeWidth: "1.5",
			strokeLinecap: "round",
			strokeLinejoin: "round"
		})]
	});
}
function CloseIcon() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		xmlns: "http://www.w3.org/2000/svg",
		viewBox: "0 0 24 24",
		fill: "none",
		width: "16",
		height: "16",
		stroke: "currentColor",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			strokeLinecap: "round",
			strokeLinejoin: "round",
			strokeWidth: "2",
			d: "M6 6l12 12M6 18L18 6"
		})
	});
}
function SearchBar({ value, onChange, placeholder = "Search..." }) {
	const [isFocused, setIsFocused] = (0, import_react.useState)(false);
	const handleChange = (e) => {
		onChange(e.target.value);
	};
	const handleClear = () => {
		onChange("");
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `${styles3.searchBar} ${isFocused ? styles3.focused : ""}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: styles3.searchIcon,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SearchIcon, {})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				type: "text",
				value,
				onChange: handleChange,
				onFocus: () => setIsFocused(true),
				onBlur: () => setIsFocused(false),
				placeholder,
				className: styles3.input
			}),
			value && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: handleClear,
				className: styles3.clearButton,
				"aria-label": "Clear search",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CloseIcon, {})
			})
		]
	});
}
function CheckIcon() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		className: "tcui-check-icon",
		xmlns: "http://www.w3.org/2000/svg",
		width: "14",
		height: "14",
		viewBox: "0 0 14 14",
		fill: "none",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			d: "M6.66667 0C2.98667 0 0 2.98667 0 6.66667C0 10.3467 2.98667 13.3333 6.66667 13.3333C10.3467 13.3333 13.3333 10.3467 13.3333 6.66667C13.3333 2.98667 10.3467 0 6.66667 0ZM9.8 5.05333L6.45333 9.12667C6.34 9.26667 6.16667 9.35333 5.98667 9.36667C5.96667 9.37333 5.95333 9.37333 5.94 9.37333C5.77333 9.37333 5.61333 9.30667 5.48667 9.19333L3.59333 7.44667C3.32667 7.2 3.30667 6.77333 3.56 6.50667C3.80667 6.23333 4.22667 6.22 4.5 6.46667L5.87333 7.73333L8.77333 4.20667C9.00667 3.92 9.42667 3.88 9.70667 4.11333C9.99333 4.34667 10.0333 4.76667 9.8 5.05333Z",
			fill: "currentColor"
		})
	});
}
function CopyIcon() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		className: "tcui-copy-icon",
		width: "16",
		height: "16",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
			x: "9",
			y: "9",
			width: "13",
			height: "13",
			rx: "2",
			ry: "2"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" })]
	});
}
function MobileSearch({ searchQuery, setSearchQuery, uri }) {
	const { copied, copy } = useCopyToClipboard();
	const handleCopyUri = async () => {
		if (!uri) return;
		await copy(uri);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: styles4.searchContainer,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SearchBar, {
			value: searchQuery,
			onChange: setSearchQuery,
			placeholder: "Search wallets..."
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			onClick: handleCopyUri,
			className: styles4.copyButton,
			"aria-label": "Copy WalletConnect URI",
			disabled: !uri,
			"data-copied": copied,
			children: copied ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CheckIcon, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CopyIcon, {})
		})]
	});
}
function Spinner() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "tcui-spinner",
		"aria-hidden": true
	});
}
function WalletButton({ name, icon, variant = "default", active = false, actionLabel = "Connect", onClick, disabled, loading, error, supportedNamespaceIcons }) {
	const handleClick = () => {
		if (!disabled && !loading) onClick?.();
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: styles5.walletButton,
		"data-variant": variant,
		"data-active": active,
		"data-disabled": disabled,
		"data-loading": loading,
		role: "button",
		tabIndex: 0,
		onClick: handleClick,
		onKeyDown: (event) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				handleClick();
			}
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: styles5.icon,
				"aria-hidden": true,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: icon,
					alt: name
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: styles5.meta,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: styles5.name,
						children: [name, active && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CheckIcon, {})]
					}),
					supportedNamespaceIcons && supportedNamespaceIcons.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: styles5.namespaces,
						children: supportedNamespaceIcons.map((nsIcon, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: nsIcon,
							alt: ""
						}, i))
					}),
					error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: styles5.error,
						children: error
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: `tcui-button ${active ? "" : "tcui-button-primary"}`,
				"data-loading": loading,
				children: loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spinner, {}) : actionLabel
			})
		]
	});
}
function MobileWalletsList({ wallets, connectingWalletId, connectionError, isLoadingMore, scrollRef, onWalletClick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: styles6.grid,
		ref: scrollRef,
		children: [wallets.map((wallet) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WalletButton, {
			name: wallet.name,
			icon: wallet.iconUrl,
			active: false,
			variant: "default",
			actionLabel: "Connect",
			onClick: () => onWalletClick(wallet),
			loading: connectingWalletId === wallet.id,
			error: connectionError ?? void 0
		}, wallet.id)), isLoadingMore && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: styles6.loadingMore,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spinner, {})
		})]
	});
}
function MobileWrapper({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: styles7.container,
		children
	});
}
function FooterWrapper({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: styles8.container,
		children
	});
}
function FooterDescription({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: styles9.description,
		children
	});
}
function FooterLink({ onClick, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		className: styles10.link,
		onClick,
		children
	});
}
function Footer() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FooterLogic, { components: {
		wrapper: FooterWrapper,
		description: FooterDescription,
		link: FooterLink
	} });
}
function MobileWalletsView() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MobileWalletsViewLogic, { components: {
		wrapper: MobileWrapper,
		search: MobileSearch,
		loading: MobileLoading,
		emptyState: MobileEmptyState,
		walletsList: MobileWalletsList,
		footer: Footer
	} });
}
function WCTitle() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: styles11.wcTitle,
		children: "Scan QR with your wallet"
	});
}
function WCGrid({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: styles12.grid,
		children
	});
}
function WalletConnectButton() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WalletConnectButtonLogic, { components: {
		title: WCTitle,
		grid: WCGrid,
		walletButton: WalletButton
	} });
}
function GetTrustWrapper({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: styles13.container,
		children
	});
}
function GetTrustMessage({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: styles14.message,
		children
	});
}
function GetTrustButton({ message }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GetTrustButtonLogic, {
		message,
		components: {
			wrapper: GetTrustWrapper,
			message: GetTrustMessage,
			walletButton: WalletButton
		}
	});
}
function WalletsHeader({ namespaceName }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
		className: styles15.sectionSub,
		children: ["Connect to ", namespaceName]
	});
}
function WalletsGrid({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: styles16.grid,
		children
	});
}
function WalletsView() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WalletsViewLogic, { components: {
		emptyState: GetTrustButton,
		header: WalletsHeader,
		grid: WalletsGrid,
		walletButton: WalletButton,
		walletConnectButton: WalletConnectButton
	} });
}
function NamespaceButton({ icon, label, onClick, actionLabel, loading, disabled, connectedWallet }) {
	const handleClick = () => {
		if (!disabled && !loading) onClick?.();
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: styles17.namespaceButton,
		role: "button",
		tabIndex: 0,
		onClick: handleClick,
		onKeyDown: (event) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				handleClick();
			}
		},
		"data-disabled": disabled,
		"data-loading": loading,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				width: 28,
				src: icon
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: styles17.meta,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: styles17.name,
					children: label
				}), connectedWallet && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: styles17.connectedWith,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: connectedWallet.icon,
						alt: "",
						className: styles17.connectedWalletIcon
					}), connectedWallet.name]
				})]
			}),
			actionLabel && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "tcui-button tcui-button-primary",
				"data-loading": loading,
				children: loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spinner, {}) : actionLabel
			})
		]
	});
}
function NamespaceHeader({ targetWallet }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: styles18.spacer,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
			className: styles18.sectionTitle,
			children: "Namespaces"
		}), targetWallet && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: styles18.badge,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: targetWallet.icon,
				alt: targetWallet.name,
				className: styles18.badgeIcon
			}), targetWallet.name]
		})]
	});
}
function NamespaceGrid({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: styles16.grid,
		children
	});
}
function NamespaceView() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NamespaceViewLogic, { components: {
		header: NamespaceHeader,
		grid: NamespaceGrid,
		namespaceButton: NamespaceButton
	} });
}
function QRWrapper({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: styles20.qr,
		role: "region",
		"aria-label": "WalletConnect QR code",
		children
	});
}
function QRPlaceholder({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: styles21.placeholder,
		children
	});
}
function QRActions({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: styles22.actions,
		children
	});
}
function QRButton({ onClick, disabled, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		className: styles23.button,
		type: "button",
		onClick,
		disabled,
		children
	});
}
function QRError({ message }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: styles24.error,
		children: message
	});
}
function QRView() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QRViewLogic, { components: {
		wrapper: QRWrapper,
		placeholder: QRPlaceholder,
		qrCode: Cuer,
		actions: QRActions,
		button: QRButton,
		error: QRError,
		spinner: Spinner
	} });
}
function ModalOverlay({ onClick, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: styles25.overlay,
		role: "presentation",
		onClick,
		children
	});
}
function ModalWrapper({ children, onClick, wrapperRef }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		ref: wrapperRef,
		className: styles26.modal,
		role: "dialog",
		"aria-modal": "true",
		"aria-label": "TrustConnect modal",
		onClick,
		children
	});
}
function BackIcon() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		xmlns: "http://www.w3.org/2000/svg",
		viewBox: "0 0 24 24",
		fill: "none",
		width: "20",
		height: "20",
		stroke: "currentColor",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			strokeLinecap: "round",
			strokeLinejoin: "round",
			strokeWidth: "2",
			d: "M15 18l-6-6 6-6"
		})
	});
}
function ModalHeader({ title, showBack, onBack, onClose }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
		className: styles27.header,
		children: [
			showBack && onBack && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: styles27.back,
				onClick: onBack,
				"aria-label": "Go back",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BackIcon, {})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: styles27.title,
				children: title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: styles27.close,
				onClick: onClose,
				"aria-label": "Close modal",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CloseIcon, {})
			})
		]
	});
}
function ModalBody({ children, bodyRef }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		ref: bodyRef,
		className: styles28.body,
		children
	});
}
function ModalError({ message }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: styles29.error,
		children: ["Error: ", message]
	});
}
function TrustModal() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrustModalLogic, {
		layout: {
			overlay: ModalOverlay,
			wrapper: ModalWrapper,
			header: ModalHeader,
			body: ModalBody,
			error: ModalError
		},
		views: [
			{
				title: "Connect a wallet",
				tag: "wallets",
				node: WalletsView
			},
			{
				title: "Select a network",
				tag: "networks",
				node: NamespaceView
			},
			{
				title: "Scan with mobile wallet",
				tag: "qr",
				node: QRView
			}
		],
		mobileViews: [{
			title: "Connect a wallet",
			tag: "wallets",
			node: MobileWalletsView
		}]
	});
}
function TrustConnectProvider({ children, config, theme }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrustConnectProvider$1, {
		config,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TrustModalProvider, {
			theme,
			children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrustModal, {})]
		})
	});
}
//#endregion
export { TrustConnectProvider, useConnect, useConnection, useConnections, useTheme, useTrustModal };

//# sourceMappingURL=@trustwallet_connect-react.js.map