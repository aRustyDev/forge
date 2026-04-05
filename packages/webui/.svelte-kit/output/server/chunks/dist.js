//#region ../../node_modules/.bun/svelte-dnd-action@0.9.69/node_modules/svelte-dnd-action/dist/index.mjs
function _defineProperty(obj, key, value) {
	if (key in obj) Object.defineProperty(obj, key, {
		value,
		enumerable: true,
		configurable: true,
		writable: true
	});
	else obj[key] = value;
	return obj;
}
var printDebug = function printDebug() {};
/**
* Resets the cache that allows for smarter "would be index" resolution. Should be called after every drag operation
*/
function resetIndexesCache() {
	printDebug(function() {
		return "resetting indexes cache";
	});
}
resetIndexesCache();
_defineProperty({}, Object.freeze({ USE_COMPUTED_STYLE_INSTEAD_OF_BOUNDING_RECT: "USE_COMPUTED_STYLE_INSTEAD_OF_BOUNDING_RECT" }).USE_COMPUTED_STYLE_INSTEAD_OF_BOUNDING_RECT, false);
var _ID_TO_INSTRUCTION;
var INSTRUCTION_IDs$1 = {
	DND_ZONE_ACTIVE: "dnd-zone-active",
	DND_ZONE_DRAG_DISABLED: "dnd-zone-drag-disabled"
};
_ID_TO_INSTRUCTION = {}, _defineProperty(_ID_TO_INSTRUCTION, INSTRUCTION_IDs$1.DND_ZONE_ACTIVE, "Tab to one the items and press space-bar or enter to start dragging it"), _defineProperty(_ID_TO_INSTRUCTION, INSTRUCTION_IDs$1.DND_ZONE_DRAG_DISABLED, "This is a disabled drag and drop list");
function createStore(initialValue) {
	var _val = initialValue;
	var subs = /* @__PURE__ */ new Set();
	return {
		get: function get() {
			return _val;
		},
		set: function set(newVal) {
			_val = newVal;
			Array.from(subs).forEach(function(cb) {
				return cb(_val);
			});
		},
		subscribe: function subscribe(cb) {
			subs.add(cb);
			cb(_val);
		},
		unsubscribe: function unsubscribe(cb) {
			subs["delete"](cb);
		}
	};
}
createStore(true);
createStore(false);
//#endregion
export {};
