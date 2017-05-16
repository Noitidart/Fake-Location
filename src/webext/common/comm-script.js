/* eslint-disable */
/* global Deferred, genericReject, genericCatch */
/* server.framescript - global Services.mm */
/* server.worker - global ChromeWorker, Worker */
/* server.content and no ports passed - global Worker, Blob */
if (typeof(gCommScope) == 'undefined') { // optional global, devuser can specify something else, and in case of Comm.client.framescript he will have to
	var gCommScope = this;
	console.log('gCommScope:', gCommScope);
}
console.log('btnClickHandler:', btnClickHandler);
var Comm = {
	unregister_generic: function(category, type, self) {
		var instances = Comm[category].instances[type];
		var l = instances.length;
		for (var i=0; i<l; i++) {
			if (instances[i] == this) {
				instances.splice(i, 1);
				break;
			}
		}
		self.unreged = true;
	},
	server: {
		webextports: function() {
			/*
			used as setup from background.js
			so in background.js do
			var gPortsComm = new Comm.server.webextport();
			*/

			var type = 'webextports';
			var category = 'server';
			var scope = gCommScope;
			Comm[category].instances[type].push(this);
			this.unreged = false;
			var messager_method = 'copyMessage';
			var ports = {};

			this.nextcbid = 1;
			this.callbackReceptacle = {};
			this.reportProgress = function(aProgressArg) {
				let { THIS, cbid, portname } = this;
				aProgressArg.__PROGRESS = 1;
				THIS.sendMessage(portname, cbid, aProgressArg);
			};

			// port messager
			this[messager_method] = function(aPortName, aMethod, aArg, aCallback) {
				// console.log('Comm.'+category+'.'+type+' - in messager_method:', aMessageManager, aMethod, aArg, aCallback);

				var cbid = null;
				if (typeof(aMethod) == 'number') {
					// this is a response to a callack waiting in framescript
					cbid = aMethod;
					aMethod = null;
				} else {
					if (aCallback) {
						cbid = this.nextcbid++;
						this.callbackReceptacle[cbid] = aCallback;
					}
				}

				ports[aPortName].postMessage({
					method: aMethod,
					arg: aArg,
					cbid: cbid
				});
			};

			// port listener
			this.listener = function handleMessage(payload) {
				console.log('Comm.'+category+'.'+type+' - incoming, payload:', payload);

				var portname = payload.portname;
				delete payload.portname;

				if (payload.method) {
					if (!(payload.method in scope)) { console.error('method of "' + payload.method + '" not in scope'); throw new Error('method of "' + payload.method + '" not in scope') }  // dev line remove on prod
					var rez_scope = scope[payload.method](payload.arg, payload.cbid ? this.reportProgress.bind({THIS:this, cbid:payload.cbid, portname:portname}) : undefined, this, portname);
					// in the return/resolve value of this method call in scope, (the rez_blah_call_for_blah = ) MUST NEVER return/resolve an object with __PROGRESS:1 in it
					if (payload.cbid) {
						if (rez_scope && rez_scope.constructor.name == 'Promise') {
							rez_scope.then(
								function(aVal) {
									// console.log('Comm.'+category+'.'+type+' - Fullfilled - rez_scope - ', aVal);
									this[messager_method](portname, payload.cbid, aVal);
								}.bind(this),
								genericReject.bind(null, 'rez_scope', 0)
							).catch(genericCatch.bind(null, 'rez_scope', 0));
						} else {
							this[messager_method](portname, payload.cbid, rez_scope);
						}
					}
				} else if (!payload.method && payload.cbid) {
					// its a cbid
					this.callbackReceptacle[payload.cbid](payload.arg, this, portname);
					if (payload.arg && !payload.arg.__PROGRESS) {
						delete this.callbackReceptacle[payload.cbid];
					}
				}
				else { console.error('Comm.'+category+'.'+type+' - invalid combination. method:', payload.method, 'cbid:', payload.cbid, 'payload:', payload); throw new Error('Comm.'+category+'.'+type+' - invalid combination'); }
			}.bind(this);

			// runtime connector
			this.connector = function(aPort) {
				console.log('Comm.'+category+'.'+type+' - incoming connect request, aPort:', aPort);
				ports[aPort.name] = aPort;
				aPort.onMessage.addListener(this.listener);
				aPort.onDisconnect.addListener(this.disconnector.bind(null, aPort.name));
			}.bind(this);

			// port disconnector
			this.disconnector = function(aPortName) {
				console.log('Comm.'+category+'.'+type+' - incoming disconnect request, aPortName:', aPortName);
				var port = ports[aPortName];
				port.onMessage.removeListener(this.listener); // probably not needed, as it was disconnected
				delete ports[aPortName];
			}.bind(this);

			// server unregister'er
			this.unregister = function() {
				if (this.unreged) { return }
				Comm.unregister_generic(category, type, this);

				for (var a_portname in ports) {
					ports[a_portname].disconnect();
				}

				chrome.runtime.onConnect.removeListener(this.connector);
			};

            this.getPort = function(aPortName) {
                return ports[aPortName];
            };

			chrome.runtime.onConnect.addListener(this.connector);
		},
		webextexe: function(aAppName, onConnect, onFailConnect) {
			/*
			used as setup from background.js
			so in background.js do
			var gExeComm = new Comm.server.webextexe();
			*/

			var type = 'webextexe';
			var category = 'server';
			var scope = gCommScope;
			Comm[category].instances[type].push(this);
			this.unreged = false;
			var messager_method = 'copyMessage';

			this.nextcbid = 1;
			this.callbackReceptacle = {};
			this.reportProgress = function(aProgressArg) {
				aProgressArg.__PROGRESS = 1;
				this.THIS[messager_method](this.cbid, aProgressArg);
			};

			this[messager_method] = function(aMethod, aArg, aCallback) {
				// console.log('Comm.'+category+'.'+type+' - in messager_method:', aMessageManager, aMethod, aArg, aCallback);

				var cbid = null;
				if (typeof(aMethod) == 'number') {
					// this is a response to a callack waiting in framescript
					cbid = aMethod;
					aMethod = null;
				} else {
					if (aCallback) {
						cbid = this.nextcbid++;
						this.callbackReceptacle[cbid] = aCallback;
					}
				}

				port.postMessage({
					method: aMethod,
					arg: aArg,
					cbid: cbid
				});
			}.bind(this);

			this.listener = function handleMessage(payload) {
				console.log('Comm.'+category+'.'+type+' - incoming, payload:', payload); // , 'messageManager:', messageManager, 'browser:', browser, 'e:', e);

				if (!connected) {
					if (payload == 'CONNECT_CONFIRMATION') { // crossfile-link994844
						connected = true;
						port.onDisconnect.removeListener(failedConnect);
						if (onConnect) setTimeout(onConnect, 0); // need the setTimeout, because if in `onConnect` user calls `callInExe` it will give undefined apparently as the `= new ` has not yet completed
					}
					else { console.error('has not proven connection yet by sending string of "connected"!') }
					return;
				}

				if (payload.method) {
					if (!(payload.method in scope)) { console.error('method of "' + payload.method + '" not in scope'); throw new Error('method of "' + payload.method + '" not in scope') }  // dev line remove on prod
					var rez_scope = scope[payload.method](payload.arg, payload.cbid ? this.reportProgress.bind({THIS:this, cbid:payload.cbid}) : undefined, this);
					// in the return/resolve value of this method call in scope, (the rez_blah_call_for_blah = ) MUST NEVER return/resolve an object with __PROGRESS:1 in it
					if (payload.cbid) {
						if (rez_scope && rez_scope.constructor.name == 'Promise') {
							rez_scope.then(
								function(aVal) {
									// console.log('Comm.'+category+'.'+type+' - Fullfilled - rez_scope - ', aVal);
									this[messager_method](payload.cbid, aVal);
								}.bind(this),
								genericReject.bind(null, 'rez_scope', 0)
							).catch(genericCatch.bind(null, 'rez_scope', 0));
						} else {
							this[messager_method](payload.cbid, rez_scope);
						}
					}
				} else if (!payload.method && payload.cbid) {
					// its a cbid
					this.callbackReceptacle[payload.cbid](payload.arg, this);
					if (payload.arg && !payload.arg.__PROGRESS) {
						delete this.callbackReceptacle[payload.cbid];
					}
				}
				else { console.error('Comm.'+category+'.'+type+' - invalid combination. method:', payload.method, 'cbid:', payload.cbid, 'payload:', payload); throw new Error('Comm.'+category+'.'+type+' - invalid combination'); }
			}.bind(this);

			this.unregister = function() {
				if (this.unreged) { return }
				Comm.unregister_generic(category, type, this);

				if (port) {
					// because `unregister` gets called when it fails to connect
					if (connected) port.disconnect();

					// port.onMessage.removeListener(this.listener); // no need to `removeListener` as I did `disconnect`
				}
			};

			var connected = false;
			var doConnect = function() {
				port = chrome.runtime.connectNative(aAppName);
				port.onMessage.addListener(this.listener);
				port.onDisconnect.addListener(failedConnect);
			}.bind(this);

			var failedConnect = function(reason) {
				console.error('failed to connect port to native!, arguments:', arguments, 'chrome.runtime.lastError:', chrome.runtime.lastError, 'arguments[0].error:', (arguments[0] && arguments[0].error ? arguments[0].error : 'NONE'));
				this.unregister();
				// var reason; // reason is unknown, chrome.runtime.lastError is null
                var error = reason.error;
				if (onFailConnect) onFailConnect(error);
			}.bind(this);

			var port;
			doConnect();
		},
		webext: function(aWebextEngine) {
			/*
			used as setup from bootstrap.js
			so in bootstrap.js do
			var gBgComm = new Comm.server.webext();
			*/

			var type = 'webext';
			var category = 'server';
			var scope = gCommScope;
			Comm[category].instances[type].push(this);
			this.unreged = false;
			var messager_method = 'copyMessage';

			this.nextcbid = 1;
			this.callbackReceptacle = {};
			this.reportProgress = function(aProgressArg) {
				aProgressArg.__PROGRESS = 1;
				this.THIS[messager_method](this.cbid, aProgressArg);
			};

			this[messager_method] = function(aMethod, aArg, aCallback) {
				// console.log('Comm.'+category+'.'+type+' - in messager_method:', aMessageManager, aMethod, aArg, aCallback);

				var cbid = null;
				if (typeof(aMethod) == 'number') {
					// this is a response to a callack waiting in framescript
					cbid = aMethod;
					aMethod = null;
				} else {
					if (aCallback) {
						cbid = this.nextcbid++;
						this.callbackReceptacle[cbid] = aCallback;
					}
				}

				port.postMessage({
					method: aMethod,
					arg: aArg,
					cbid: cbid
				});
			}.bind(this);

			this.listener = function handleMessage(payload) {
				console.log('Comm.'+category+'.'+type+' - incoming, payload:', payload); // , 'messageManager:', messageManager, 'browser:', browser, 'e:', e);

				if (payload.method) {
					if (!(payload.method in scope)) { console.error('Comm.'+category+'.'+type+' - method of "' + payload.method + '" not in scope'); throw new Error('method of "' + payload.method + '" not in scope') }  // dev line remove on prod
					var rez_scope = scope[payload.method](payload.arg, payload.cbid ? this.reportProgress.bind({THIS:this, cbid:payload.cbid}) : undefined, this);
					// in the return/resolve value of this method call in scope, (the rez_blah_call_for_blah = ) MUST NEVER return/resolve an object with __PROGRESS:1 in it
					if (payload.cbid) {
						if (rez_scope && rez_scope.constructor.name == 'Promise') {
							rez_scope.then(
								function(aVal) {
									// console.log('Comm.'+category+'.'+type+' - Fullfilled - rez_scope - ', aVal);
									this[messager_method](payload.cbid, aVal);
								}.bind(this),
								genericReject.bind(null, 'rez_scope', 0)
							).catch(genericCatch.bind(null, 'rez_scope', 0));
						} else {
							this[messager_method](payload.cbid, rez_scope);
						}
					}
				} else if (!payload.method && payload.cbid) {
					// its a cbid
					this.callbackReceptacle[payload.cbid](payload.arg, this);
					if (payload.arg && !payload.arg.__PROGRESS) {
						delete this.callbackReceptacle[payload.cbid];
					}
				}
				else { console.error('Comm.'+category+'.'+type+' - invalid combination. method:', payload.method, 'cbid:', payload.cbid, 'payload:', payload); throw new Error('Comm.'+category+'.'+type+' - invalid combination'); }
			}.bind(this);

			this.unregister = function() {
				if (this.unreged) { return }
				Comm.unregister_generic(category, type, this);

				// no need for shtudown of this port as per irc -
					// 11:39:47 	<@John-Frum>	noit: No, they're shutdown automatically when the main extension shuts down

				// port does have .disconnect() though
			};

			var onConnect = function(aPort) {
				if (aPort.name == 'bootstrap-comm') {
					port = aPort;
					// console.log('ok webext connection made, port:', port);
					port.onMessage.addListener(this.listener);
					browser.runtime.onConnect.removeListener(onConnect);
					browser = null;
				}
				else { console.warn('name of aPort coming to Comm.server.webext IS NOT bootstrap-comm it is:', aPort.name)}
			}.bind(this);

			var port;
			var browser;
			aWebextEngine.startup().then(api => {
				browser = api.browser;
				// console.log('ok webext started up, waiting for onConnect');
				browser.runtime.onConnect.addListener(onConnect);
			});
		},
		// NOTE: these below should be executed OUT of the scope. like `new Comm.server.worker()` should be executed in bootstrap or another worker
		worker: function(aWorkerPath, onBeforeInit, onAfterInit, onBeforeTerminate, aWebWorker) {
			// onBeforeTerminate can return promise, once promise is resolved, in which it will hold off to terminate till that promise is resolved
			var type = 'worker';
			var category = 'server';
			var scope = gCommScope;
			Comm[category].instances[type].push(this);
			this.unreged = false;
			var messager_method = 'putMessage';

			var worker;

			this.nextcbid = 1;
			this.callbackReceptacle = {};
			this.reportProgress = function(aProgressArg) {
				aProgressArg.__PROGRESS = 1;
				this.THIS[messager_method](this.cbid, aProgressArg);
			};

			this[messager_method] = function(aMethod, aArg, aCallback) {
				// aMethod is a string - the method to call in framescript
				// aCallback is a function - optional - it will be triggered when aMethod is done calling

				if (!worker) {
					this.createWorker(this[messager_method].bind(this, aMethod, aArg, aCallback));
				} else {
					var aTransfers;
					if (aArg && aArg.__XFER) {
						// if want to transfer stuff aArg MUST be an object, with a key __XFER holding the keys that should be transferred
						// __XFER is either array or object. if array it is strings of the keys that should be transferred. if object, the keys should be names of the keys to transfer and values can be anything
						aTransfers = [];
						var __XFER = aArg.__XFER;
						if (Array.isArray(__XFER)) {
							for (var p of __XFER) {
								aTransfers.push(aArg[p]);
							}
						} else {
							// assume its an object
							for (var p in __XFER) {
								aTransfers.push(aArg[p]);
							}
						}
					}
					var cbid = null;
					if (typeof(aMethod) == 'number') {
						// this is a response to a callack waiting in framescript
						cbid = aMethod;
						aMethod = null;
					} else {
						if (aCallback) {
							cbid = this.nextcbid++;
							this.callbackReceptacle[cbid] = aCallback;
						}
					}

					worker.postMessage({
						method: aMethod,
						arg: aArg,
						cbid: cbid
					}, aTransfers);
				}
			}.bind(this);

			this.listener = function(e) {
				var payload = e.data;
				console.log('Comm.'+category+'.'+type+' - incoming, payload:', payload); //, 'e:', e);

				if (payload.method) {
					if (payload.method == 'triggerOnAfterInit') {
						if (onAfterInit) {
							onAfterInit(payload.arg, this);
						}
						return;
					}
					if (!(payload.method in scope)) { console.error('method of "' + payload.method + '" not in scope'); throw new Error('method of "' + payload.method + '" not in scope') } // dev line remove on prod
					var rez_scope = scope[payload.method](payload.arg, payload.cbid ? this.reportProgress.bind({THIS:this, cbid:payload.cbid}) : undefined, this);
					// in the return/resolve value of this method call in scope, (the rez_blah_call_for_blah = ) MUST NEVER return/resolve an object with __PROGRESS:1 in it

					if (payload.cbid) {
						if (rez_scope && rez_scope.constructor.name == 'Promise') {
							rez_scope.then(
								function(aVal) {
									// console.log('Comm.'+category+'.'+type+' - Fullfilled - rez_scope - ', aVal);
									this[messager_method](payload.cbid, aVal);
								}.bind(this),
								genericReject.bind(null, 'rez_scope', 0)
							).catch(genericCatch.bind(null, 'rez_scope', 0));
						} else {
							this[messager_method](payload.cbid, rez_scope);
						}
					}
				} else if (!payload.method && payload.cbid) {
					// its a cbid
					this.callbackReceptacle[payload.cbid](payload.arg, this);
					if (payload.arg && !payload.arg.__PROGRESS) {
						delete this.callbackReceptacle[payload.cbid];
					}
				}
				else { console.error('Comm.'+category+'.'+type+' - invalid combination. method:', payload.method, 'cbid:', payload.cbid, 'payload:', payload); throw new Error('Comm.'+category+'.'+type+' - invalid combination'); }
			}.bind(this);

			this.unregister = function() {
				if (this.unreged) { return }
				var theself = this;

				var unregIt = function(aCaught) {
					if (aCaught) {
						console.error('caught an error while running your onBeforeTerminate function, aCaught:', aCaught);
					}
					Comm.unregister_generic(category, type, theself);
					console.log('Comm.js doing worker.terminate');
					if (worker) {
						worker.terminate();
					}
				};

				if (worker && onBeforeTerminate) {
					var rez_preterm = onBeforeTerminate();
					if (rez_preterm && rez_preterm.constructor.name == 'Promise') {
						console.log('rez_preterm was a promise');
						rez_preterm.then(unregIt, unregIt).catch(aCaught=>unregIt.bind(null, aCaught));
					} else {
						unregIt();
					}
				} else {
					unregIt();
				}
			};

			this.createWorker = function(onAfterCreate) {
				// only triggered by putMessage when `var worker` has not yet been set
				worker = aWebWorker ? new Worker(aWorkerPath) : new ChromeWorker(aWorkerPath);
				worker.addEventListener('message', this.listener);

				if (onAfterInit) {
					var oldOnAfterInit = onAfterInit;
					onAfterInit = function(aArg, aComm) {
						oldOnAfterInit(aArg, aComm);
						if (onAfterCreate) {
							onAfterCreate(); // link39399999
						}
					}
				}

				var initArg;
				if (onBeforeInit) {
					initArg = onBeforeInit(this);
					if (onAfterInit) {
						this[messager_method]('init', initArg); // i dont put onAfterCreate as a callback here, because i want to gurantee that the call of onAfterCreate happens after onAfterInit is triggered link39399999
					} else {
						this[messager_method]('init', initArg, onAfterCreate);
					}
				} else {
					// else, worker is responsible for calling init. worker will know because it keeps track in listener, what is the first putMessage, if it is not "init" then it will run init
					if (onAfterCreate) {
						onAfterCreate(); // as putMessage i the only one who calls this.createWorker(), onAfterCreate is the origianl putMessage intended by the devuser
					}
				}
			};
		},
		content: function(aContentWindow, onHandshakeComplete) {
            var msgchan = new MessageChannel();
            console.log('msgchan:', msgchan);
            var aPort1 = msgchan.port1;
            var aPort2 = msgchan.port2;

			var type = 'content';
			var category = 'server';
			var scope = gCommScope;
			Comm[category].instances[type].push(this);
			this.unreged = false;
			var messager_method = 'putMessage';

			var handshakeComplete = false; // indicates this[messager_method] will now work i think. it might work even before though as the messages might be saved till a listener is setup? i dont know i should ask

			this.nextcbid = 1;
			this.callbackReceptacle = {};
			this.reportProgress = function(aProgressArg) {
				aProgressArg.__PROGRESS = 1;
				this.THIS[messager_method](this.cbid, aProgressArg);
			};

			this[messager_method] = function(aMethod, aArg, aCallback) {
				// aMethod is a string - the method to call in framescript
				// aCallback is a function - optional - it will be triggered when aMethod is done calling
				var aTransfers;
				if (aArg && aArg.__XFER) {
					// if want to transfer stuff aArg MUST be an object, with a key __XFER holding the keys that should be transferred
					// __XFER is either array or object. if array it is strings of the keys that should be transferred. if object, the keys should be names of the keys to transfer and values can be anything
					aTransfers = [];
					var __XFER = aArg.__XFER;
					if (Array.isArray(__XFER)) {
						for (var p of __XFER) {
							aTransfers.push(aArg[p]);
						}
					} else {
						// assume its an object
						for (var p in __XFER) {
							aTransfers.push(aArg[p]);
						}
					}
				}

				var cbid = null;
				if (typeof(aMethod) == 'number') {
					// this is a response to a callack waiting in framescript
					cbid = aMethod;
					aMethod = null;
				} else {
					if (aCallback) {
						cbid = this.nextcbid++;
						this.callbackReceptacle[cbid] = aCallback;
					}
				}

				aPort1.postMessage({
					method: aMethod,
					arg: aArg,
					cbid: cbid
				}, aTransfers);
			}.bind(this);

			this.listener = function(e) {
				var payload = e.data;
				console.log('Comm.'+category+'.'+type+' - incoming, payload:', payload); //, 'e:', e);

				if (payload.method) {
					if (payload.method == 'contentComm_handshake_finalized') {
						handshakeComplete = false;
						if (onHandshakeComplete) {
							onHandshakeComplete(this);
						}
						return;
					}
					if (!(payload.method in scope)) { console.error('method of "' + payload.method + '" not in scope'); throw new Error('method of "' + payload.method + '" not in scope') } // dev line remove on prod
					var rez_scope = scope[payload.method](payload.arg, payload.cbid ? this.reportProgress.bind({THIS:this, cbid:payload.cbid}) : undefined, this);
					// in the return/resolve value of this method call in scope, (the rez_blah_call_for_blah = ) MUST NEVER return/resolve an object with __PROGRESS:1 in it
					// console.log('Comm.'+category+'.'+type+' - Fullfilled - rez_scope - rez_scope:', rez_scope);

					if (payload.cbid) {
						if (rez_scope && rez_scope.constructor.name == 'Promise') {
							rez_scope.then(
								function(aVal) {
									// console.log('Comm.'+category+'.'+type+' - Fullfilled - rez_scope - ', aVal);
									this[messager_method](payload.cbid, aVal);
								}.bind(this),
								genericReject.bind(null, 'rez_scope', 0)
							).catch(genericCatch.bind(null, 'rez_scope', 0));
						} else {
							this[messager_method](payload.cbid, rez_scope);
						}
					}
				} else if (!payload.method && payload.cbid) {
					// its a cbid
					this.callbackReceptacle[payload.cbid](payload.arg, this);
					if (payload.arg && !payload.arg.__PROGRESS) {
						delete this.callbackReceptacle[payload.cbid];
					}
				}
				else { console.error('Comm.'+category+'.'+type+' - invalid combination. method:', payload.method, 'cbid:', payload.cbid, 'payload:', payload); throw new Error('Comm.'+category+'.'+type+' - invalid combination'); }
			}.bind(this);

			this.unregister = function() {
				if (this.unreged) { return }
				Comm.unregister_generic(category, type, this);
			};

			var postPortsGot = function() {
				console.log('Comm.'+category+'.'+type+' - attaching listener and posting message, this.listener:', this.listener);
				aPort1.onmessage = this.listener;
				aContentWindow.postMessage({
					topic: 'contentComm_handshake',
					port2: aPort2
				}, '*', [aPort2]);
			}.bind(this);

			postPortsGot();
		},
		instances: {worker:[], framescript:[], content:[], webextexe:[], webextports:[], webext:[]},
		unregAll: function(aType) {
			var category = 'server';
			var type_instances_clone = Comm[category].instances[aType].slice(); // as the .unregister will remove it from the original array

			var l = type_instances_clone.length;
			for (var inst of type_instances_clone) {
				inst.unregister();
			}
		}
	},
	client: {
		webextports: function(aPortType) {
			// aPortType - string - optional; default:"general" - anything you want. for instance, "tab", "popup", whatever. "general" though is reserved". this is me just planning for future, for like in case i want to broad cast to all ports of a certain type
			// TODO: probably handle .onDisconnect of the port
			/*
				used as setup from content scripts/popup.js etc
				var gBgComm = new Comm.client.webextports();
			*/
			this.porttype = aPortType || 'general';
			this.portname = this.porttype + '-' + Math.random();

			var type = 'webextports';
			var category = 'client';
			var scope = gCommScope;
			Comm[category].instances[type].push(this);
			this.unreged = false;
			var messager_method = 'copyMessage';

			this.nextcbid = 1;
			this.callbackReceptacle = {};
			this.reportProgress = function(aProgressArg) {
				aProgressArg.__PROGRESS = 1;
				this.THIS[messager_method](this.cbid, aProgressArg);
			};

			this[messager_method] = function(aMethod, aArg, aCallback) {
				var cbid = null;
				if (typeof(aMethod) == 'number') {
					// this is a response to a callack waiting in framescript
					cbid = aMethod;
					aMethod = null;
				} else {
					if (aCallback) {
						cbid = this.nextcbid++;
						this.callbackReceptacle[cbid] = aCallback;
					}
				}

				port.postMessage({
					method: aMethod,
					arg: aArg,
					cbid: cbid,
					portname: this.portname
				});
			}.bind(this);

			this.listener = function handleMessage(payload) {
				console.log('Comm.'+category+'.'+type+' - incoming, payload:', payload); // , 'messageManager:', messageManager, 'browser:', browser, 'e:', e);

				if (payload.method) {
					if (!(payload.method in scope)) { console.error('method of "' + payload.method + '" not in scope'); throw new Error('method of "' + payload.method + '" not in scope') }  // dev line remove on prod
					var rez_scope = scope[payload.method](payload.arg, payload.cbid ? this.reportProgress.bind({THIS:this, cbid:payload.cbid}) : undefined, this);
					// in the return/resolve value of this method call in scope, (the rez_blah_call_for_blah = ) MUST NEVER return/resolve an object with __PROGRESS:1 in it
					if (payload.cbid) {
						if (rez_scope && rez_scope.constructor.name == 'Promise') {
							rez_scope.then(
								function(aVal) {
									// console.log('Comm.'+category+'.'+type+' - Fullfilled - rez_scope - ', aVal);
									this[messager_method](payload.cbid, aVal);
								}.bind(this),
								genericReject.bind(null, 'rez_scope', 0)
							).catch(genericCatch.bind(null, 'rez_scope', 0));
						} else {
							this[messager_method](payload.cbid, rez_scope);
						}
					}
				} else if (!payload.method && payload.cbid) {
					// its a cbid
					this.callbackReceptacle[payload.cbid](payload.arg, this);
					if (payload.arg && !payload.arg.__PROGRESS) {
						delete this.callbackReceptacle[payload.cbid];
					}
				}
				else { console.error('Comm.'+category+'.'+type+' - invalid combination. method:', payload.method, 'cbid:', payload.cbid, 'payload:', payload); throw new Error('Comm.'+category+'.'+type+' - invalid combination'); }
			}.bind(this);

			// port disconnector
			this.disconnector = function(aPortName) {
				// TODO: untested, i couldnt figure out how to get this to trigger. and i didnt do a `port.disconnect()` from background.js
				console.log('Comm.'+category+'.'+type+' - incoming disconnect request, aPortName:', aPortName);
				// aPort.onMessage.removeListener(this.listener); // probably not needed, as it was disconnected
				// delete ports[aPortName];
				this.unregister();
			}.bind(this);

			this.unregister = function() {
				if (this.unreged) { return }
				Comm.unregister_generic(category, type, this);

				port.onMessage.removeListener(this.listener); // i probably dont need this as I do `port.disconnect` on next line
				port.disconnect();
			};

            this.getPort = function() {
                return port;
            };

			var port = chrome.runtime.connect({name:this.portname});
			port.onMessage.addListener(this.listener);
			port.onDisconnect.addListener(this.disconnector);
		},
		webext: function() {
			/*
				used as setup from background.js
				var gBsComm = new Comm.client.webext();
			*/
			var type = 'webext';
			var category = 'client';
			var scope = gCommScope;
			Comm[category].instances[type].push(this);
			this.unreged = false;
			var messager_method = 'copyMessage';

			this.nextcbid = 1;
			this.callbackReceptacle = {};
			this.reportProgress = function(aProgressArg) {
				aProgressArg.__PROGRESS = 1;
				this.THIS[messager_method](this.cbid, aProgressArg);
			};

			this[messager_method] = function(aMethod, aArg, aCallback) {
				var cbid = null;
				if (typeof(aMethod) == 'number') {
					// this is a response to a callack waiting in framescript
					cbid = aMethod;
					aMethod = null;
				} else {
					if (aCallback) {
						cbid = this.nextcbid++;
						this.callbackReceptacle[cbid] = aCallback;
					}
				}

				port.postMessage({
					method: aMethod,
					arg: aArg,
					cbid: cbid
				});
			}.bind(this);

			this.listener = function handleMessage(payload) {
				console.log('Comm.'+category+'.'+type+' - incoming, payload:', payload); // , 'messageManager:', messageManager, 'browser:', browser, 'e:', e);

				if (payload.method) {
					if (!(payload.method in scope)) { console.error('method of "' + payload.method + '" not in scope'); throw new Error('method of "' + payload.method + '" not in scope') }  // dev line remove on prod
					var rez_scope = scope[payload.method](payload.arg, payload.cbid ? this.reportProgress.bind({THIS:this, cbid:payload.cbid}) : undefined, this);
					// in the return/resolve value of this method call in scope, (the rez_blah_call_for_blah = ) MUST NEVER return/resolve an object with __PROGRESS:1 in it
					if (payload.cbid) {
						if (rez_scope && rez_scope.constructor.name == 'Promise') {
							rez_scope.then(
								function(aVal) {
									// console.log('Comm.'+category+'.'+type+' - Fullfilled - rez_scope - ', aVal);
									this[messager_method](payload.cbid, aVal);
								}.bind(this),
								genericReject.bind(null, 'rez_scope', 0)
							).catch(genericCatch.bind(null, 'rez_scope', 0));
						} else {
							this[messager_method](payload.cbid, rez_scope);
						}
					}
				} else if (!payload.method && payload.cbid) {
					// its a cbid
					this.callbackReceptacle[payload.cbid](payload.arg, this);
					if (payload.arg && !payload.arg.__PROGRESS) {
						delete this.callbackReceptacle[payload.cbid];
					}
				}
				else { console.error('Comm.'+category+'.'+type+' - invalid combination. method:', payload.method, 'cbid:', payload.cbid, 'payload:', payload); throw new Error('Comm.'+category+'.'+type+' - invalid combination'); }
			}.bind(this);

			this.unregister = function() {
				if (this.unreged) { return }
				Comm.unregister_generic(category, type, this);
				port.onMessage.removeListener(this.listener);
			};

			var port = browser.runtime.connect({ name:'bootstrap-comm' });
			port.onMessage.addListener(this.listener);
		},
		// these should be excuted in the respective scope, like `new Comm.client.worker()` in worker, framescript in framescript, content in content
		worker: function() {
			var type = 'worker';
			var category = 'client';
			var scope = gCommScope;
			Comm[category].instances[type].push(this);
			this.unreged = false;
			var messager_method = 'putMessage';

			var firstMethodCalled = false;

			this.nextcbid = 1;
			this.callbackReceptacle = {};
			this.reportProgress = function(aProgressArg) {
				aProgressArg.__PROGRESS = 1;
				this.THIS[messager_method](this.cbid, aProgressArg);
			};

			this[messager_method] = function(aMethod, aArg, aCallback) {
				var cbid = null;
				if (typeof(aMethod) == 'number') {
					// this is a response to a callack waiting in framescript
					cbid = aMethod;
					aMethod = null;
				} else {
					if (aCallback) {
						cbid = this.nextcbid++;
						this.callbackReceptacle[cbid] = aCallback;
					}
				}

				var aTransfers;
				if (aArg && aArg.__XFER) {
					// if want to transfer stuff aArg MUST be an object, with a key __XFER holding the keys that should be transferred
					// __XFER is either array or object. if array it is strings of the keys that should be transferred. if object, the keys should be names of the keys to transfer and values can be anything
					aTransfers = [];
					var __XFER = aArg.__XFER;
					if (Array.isArray(__XFER)) {
						for (var p of __XFER) {
							aTransfers.push(aArg[p]);
						}
					} else {
						// assume its an object
						for (var p in __XFER) {
							aTransfers.push(aArg[p]);
						}
					}
				}

				self.postMessage({
					method: aMethod,
					arg: aArg,
					cbid: cbid
				}, aTransfers);
			}.bind(this);

			this.listener = function(e) {
				var payload = e.data;
				console.log('Comm.'+category+'.'+type+' - incoming, payload:', payload); //, 'e:', e);

				if (payload.method) {
					if (!firstMethodCalled) {
						firstMethodCalled = true;
						if (payload.method != 'init' && scope.init) {
							this[messager_method]('triggerOnAfterInit', scope.init(undefined, this));
						}
					}
					if (!(payload.method in scope)) { console.error('Comm.'+category+'.'+type+' - method of "' + payload.method + '" not in scope'); throw new Error('method of "' + payload.method + '" not in scope') } // dev line remove on prod
					var rez_scope = scope[payload.method](payload.arg, payload.cbid ? this.reportProgress.bind({THIS:this, cbid:payload.cbid}) : undefined, this);
					// in the return/resolve value of this method call in scope, (the rez_blah_call_for_blah = ) MUST NEVER return/resolve an object with __PROGRESS:1 in it
					// console.log('Comm.'+category+'.'+type+' - rez_scope:', rez_scope);
					if (payload.cbid) {
						if (rez_scope && rez_scope.constructor.name == 'Promise') {
							rez_scope.then(
								function(aVal) {
									console.log('Comm.'+category+'.'+type+' - Fullfilled - rez_scope - ', aVal);
									this[messager_method](payload.cbid, aVal);
								}.bind(this),
								genericReject.bind(null, 'rez_scope', 0)
							).catch(genericCatch.bind(null, 'rez_scope', 0));
						} else {
							this[messager_method](payload.cbid, rez_scope);
						}
					}
					// gets here on programtic init, as it for sure does not have a callback
					if (payload.method == 'init') {
						this[messager_method]('triggerOnAfterInit', rez_scope);
					}
				} else if (!payload.method && payload.cbid) {
					// its a cbid
					this.callbackReceptacle[payload.cbid](payload.arg, this);
					if (payload.arg && !payload.arg.__PROGRESS) {
						delete this.callbackReceptacle[payload.cbid];
					}
				}
				else { console.error('Comm.'+category+'.'+type+' - invalid combination. method:', payload.method, 'cbid:', payload.cbid, 'payload:', payload); throw new Error('Comm.'+category+'.'+type+' - invalid combination'); }
			}.bind(this);

			this.unregister = function() {
				if (this.unreged) { return }
				Comm.unregister_generic(category, type, this);
			};

			self.onmessage = this.listener;
		},
		content: function(onHandshakeComplete) {
			var type = 'content';
			var category = 'client';
			var scope = gCommScope;
			Comm[category].instances[type].push(this);
			this.unreged = false;
			var messager_method = 'putMessage';

			var handshakeComplete = false; // indicates this[messager_method] will now work
			var port;

			this.nextcbid = 1;
			this.callbackReceptacle = {};
			this.reportProgress = function(aProgressArg) {
				aProgressArg.__PROGRESS = 1;
				this.THIS[messager_method](this.cbid, aProgressArg);
			};

			this[messager_method] = function(aMethod, aArg, aCallback) {
				// determine aTransfers
				var aTransfers;
				var xferScope;
				var xferIterable;
				if (aArg) {
					if (aArg.__XFER) {
						xferIterable = aArg.__XFER;
						xferScope = aArg;
					} else if (aArg.a && aArg.m && aArg.a.__XFER) { // special handle for callIn***
						xferIterable = aArg.a.__XFER;
						xferScope = aArg.a;
					}
				}
				if (xferScope) {
					// if want to transfer stuff aArg MUST be an object, with a key __XFER holding the keys that should be transferred
					// __XFER is either array or object. if array it is strings of the keys that should be transferred. if object, the keys should be names of the keys to transfer and values can be anything
					aTransfers = [];
					if (Array.isArray(xferIterable)) {
						for (var p of xferIterable) {
							aTransfers.push(xferScope[p]);
						}
					} else {
						// assume its an object
						for (var p in xferIterable) {
							aTransfers.push(xferScope[p]);
						}
					}
				}

				var cbid = null;
				if (typeof(aMethod) == 'number') {
					// this is a response to a callack waiting in framescript
					cbid = aMethod;
					aMethod = null;
				} else {
					if (aCallback) {
						cbid = this.nextcbid++;
						this.callbackReceptacle[cbid] = aCallback;
					}
				}

				port.postMessage({
					method: aMethod,
					arg: aArg,
					cbid: cbid
				}, aTransfers);
			}.bind(this);

			this.listener = function(e) {
				var payload = e.data;
				console.log('Comm.'+category+'.'+type+' - incoming, payload:', payload); // , 'e:', e, 'this:', this);

				if (payload.method) {
					if (!(payload.method in scope)) { console.error('Comm.'+category+'.'+type+' - method of "' + payload.method + '" not in WINDOW'); throw new Error('method of "' + payload.method + '" not in WINDOW') } // dev line remove on prod
					var rez_scope = scope[payload.method](payload.arg, payload.cbid ? this.reportProgress.bind({THIS:this, cbid:payload.cbid}) : undefined, this);
					// in the return/resolve value of this method call in scope, (the rez_blah_call_for_blah = ) MUST NEVER return/resolve an object with __PROGRESS:1 in it
					// console.log('Comm.'+category+'.'+type+' - rez_scope:', rez_scope);
					if (payload.cbid) {
						if (rez_scope && rez_scope.constructor.name == 'Promise') {
							rez_scope.then(
								function(aVal) {
									console.log('Comm.'+category+'.'+type+' - Fullfilled - rez_scope - ', aVal);
									this[messager_method](payload.cbid, aVal);
								}.bind(this),
								genericReject.bind(null, 'rez_scope', 0)
							).catch(genericCatch.bind(null, 'rez_scope', 0));
						} else {
							this[messager_method](payload.cbid, rez_scope);
						}
					}
				} else if (!payload.method && payload.cbid) {
					// its a cbid
					this.callbackReceptacle[payload.cbid](payload.arg, this);
					if (payload.arg && !payload.arg.__PROGRESS) {
						delete this.callbackReceptacle[payload.cbid];
					}
				}
				else { console.error('Comm.'+category+'.'+type+' - invalid combination. method:', payload.method, 'cbid:', payload.cbid, 'payload:', payload); throw new Error('Comm.'+category+'.'+type+' - invalid combination'); }
			}.bind(this);

			this.unregister = function() {
				if (this.unreged) { return }
				Comm.unregister_generic(category, type, this);
			};

			var winMsgListener = function(e) {
				var data = e.data;
				// console.log('Comm.'+category+'.'+type+' - incoming window message, data:', uneval(data)); //, 'source:', e.source, 'ports:', e.ports);
				switch (data.topic) {
					case 'contentComm_handshake':

							console.log('Comm.'+category+'.'+type+' - in handshake');
							window.removeEventListener('message', winMsgListener, false);
							port = data.port2;
							port.onmessage = this.listener;
							this[messager_method]('contentComm_handshake_finalized');
							handshakeComplete = true;
							if (onHandshakeComplete) {
								onHandshakeComplete(true);
							}
						break; default: console.error('Comm.'+category+'.'+type+' - unknown topic, data:', data);
				}
			}.bind(this);

			window.addEventListener('message', winMsgListener, false);
		},
		instances: {worker:[], framescript:[], content:[], webextports:[], webext:[]},
		unregAll: function(aType) {
			var category = 'client';
			var type_instances_clone = Comm[category].instances[aType].slice(); // as the .unregister will remove it from the original array

			var l = type_instances_clone.length;
			for (var inst of type_instances_clone) {
				inst.unregister();
			}
		}
	},
	callInX2: function(aCommTo, aCallInMethod, aMessageManagerOrTabId, aMethod, aArg, aCallback) {
		// second version of callInX, after i started working on webext part of Comm
		// MUST not be used directly, MUSt have aCommTo and aCallInMethod bounded
		aCommTo = typeof(aCommTo) == 'string' ? gCommScope[aCommTo] : aCommTo;
		var messagerMethod;
		if (aCommTo.copyMessage) {
			if (aMessageManagerOrTabId) {
				// server - so this is bootstrap obviously
				messagerMethod = aCommTo.copyMessage.bind(aCommTo, aMessageManagerOrTabId);
			} else {
				// client
				messagerMethod = aCommTo.copyMessage;
			}
		} else {
			messagerMethod = aCommTo.putMessage;
		}

		if (aMethod.constructor.name == 'Object') {
			var aReportProgress = aArg;
			var aCommFrom = aCallback;
			({m:aMethod, a:aArg} = aMethod);
			if (!aCallInMethod) {
				if (aReportProgress) { // if it has aReportProgress then the scope has a callback waiting for reply
					var deferred = new Deferred();
					messagerMethod(aMethod, aArg, function(rez) {
						if (rez && rez.__PROGRESS) {
							aReportProgress(rez);
						} else {
							deferred.resolve(rez);
						}
					});
					return deferred.promise;
				} else {
					messagerMethod(aMethod, aArg);
				}
			} else {
				if (aReportProgress) { // if it has aReportProgress then the scope has a callback waiting for reply
					var deferred = new Deferred();
					messagerMethod(aCallInMethod, {
						m: aMethod,
						a: aArg
					}, function(rez) {
						if (rez && rez.__PROGRESS) {
							aReportProgress(rez);
						} else {
							deferred.resolve(rez);
						}
					});
					return deferred.promise;
				} else {
					messagerMethod(aCallInMethod, {
						m: aMethod,
						a: aArg
					});
				}
			}
		} else {
			if (!aCallInMethod) {
				messagerMethod(aMethod, aArg, aCallback);
			} else {
				messagerMethod(aCallInMethod, {
					m: aMethod,
					a: aArg
				}, aCallback);
			}
		}
	},
	callInX: function(aCommTo, aCallInMethod, aMethod, aArg, aCallback, aMessageManager) {
		// MUST not be used directly, MUSt have aCommTo and aCallInMethod bounded
		aCommTo = typeof(aCommTo) == 'string' ? gCommScope[aCommTo] : aCommTo;
		var messagerMethod;
		if (aCommTo.copyMessage) {
			if (aMessageManager) {
				// server - so this is bootstrap obviously
				messagerMethod = aCommTo.copyMessage.bind(aCommTo, aMessageManager);
			} else {
				// client
				messagerMethod = aCommTo.copyMessage;
			}
		} else {
			messagerMethod = aCommTo.putMessage;
		}

		if (aMethod.constructor.name == 'Object') {
			var aReportProgress = aArg;
			var aCommFrom = aCallback;
			({m:aMethod, a:aArg} = aMethod);
			if (!aCallInMethod) {
				if (aReportProgress) { // if it has aReportProgress then the scope has a callback waiting for reply
					var deferred = new Deferred();
					messagerMethod(aMethod, aArg, function(rez) {
						if (rez && rez.__PROGRESS) {
							aReportProgress(rez);
						} else {
							deferred.resolve(rez);
						}
					});
					return deferred.promise;
				} else {
					messagerMethod(aMethod, aArg);
				}
			} else {
				if (aReportProgress) { // if it has aReportProgress then the scope has a callback waiting for reply
					var deferred = new Deferred();
					messagerMethod(aCallInMethod, {
						m: aMethod,
						a: aArg
					}, function(rez) {
						if (rez && rez.__PROGRESS) {
							aReportProgress(rez);
						} else {
							deferred.resolve(rez);
						}
					});
					return deferred.promise;
				} else {
					messagerMethod(aCallInMethod, {
						m: aMethod,
						a: aArg
					});
				}
			}
		} else {
			if (!aCallInMethod) {
				messagerMethod(aMethod, aArg, aCallback);
			} else {
				messagerMethod(aCallInMethod, {
					m: aMethod,
					a: aArg
				}, aCallback);
			}
		}
	}
};

// these helpers are placed in the respective scope. like bootstrap section are all methods to be placed in bootstrap
// all helpers have 3 arguments, aMethod, aArg, aCallback EXCEPT for callInFramescript which has 4th arg of aMessageManager
var CommHelper = {
	bootstrap: {
		callInMainworker: Comm.callInX.bind(null, 'gWkComm', null),
		callInContent1: Comm.callInX.bind(null, 'gBlahComm1', null),
		callInContentinframescript: Comm.callInX.bind(null, 'gFsComm', 'callInContent'),
		callInFramescript: Comm.callInX.bind(null, 'gFsComm', null),
		callInBackground: Comm.callInX2.bind(null, 'gBgComm', null, null),
		callInExe: Comm.callInX2.bind(null, 'gBgComm', 'gExeComm', null)
	},
	mainworker: {
		callInBootstrap: Comm.callInX.bind(null, 'gBsComm', null),
		callInChildworker1: Comm.callInX.bind(null, 'gBlahComm1', null)
	},
	childworker: {
		callInMainworker: Comm.callInX.bind(null, 'gWkComm', null),
		callInBootstrap: Comm.callInX.bind(null, 'gWkComm', 'callInBootstrap')
	},
	content: {
		callInMainworker: Comm.callInX.bind(null, 'gBsComm', 'callInMainworker'),
		callInBootstrap: Comm.callInX.bind(null, 'gBsComm', null)
	},
	framescript: {
		callInBootstrap: Comm.callInX.bind(null, 'gBsComm', null),
		callInContent: Comm.callInX.bind(null, 'gWinComm', null),
		callInMainworker: Comm.callInX.bind(null, 'gBsComm', 'callInMainworker')
	},
	contentinframescript: {
		callInFramescript: Comm.callInX.bind(null, 'gFsComm', null),
		callInMainworker: Comm.callInX.bind(null, 'gFsComm', 'callInMainworker'),
		callInBootstrap: Comm.callInX.bind(null, 'gFsComm', 'callInBootstrap')
	},
	webextbackground: {
		callInExe: Comm.callInX2.bind(null, 'gExeComm', null, null),
		callInAPort: Comm.callInX2.bind(null, 'gPortsComm', null)
	},
	webextcontentscript: {
		callInExe: Comm.callInX2.bind(null, 'gBgComm', 'callInExe', null),
		callInBackground: Comm.callInX2.bind(null, 'gBgComm', null, null)
	},
	// the below are not used, just brainstorming what exe needs
	webextexe: {
		callInBackground: function() {},
		callInThread: function() {}
	},
	webextexethread: {
		callInExe: function() {},
		callInBackground: function() {}
	}
};

function Deferred() {
	this.resolve = null;
	this.reject = null;
	this.promise = new Promise(function(resolve, reject) {
		this.resolve = resolve;
		this.reject = reject;
	}.bind(this));
	Object.freeze(this);
}
function genericReject(aPromiseName, aPromiseToReject, aReason) {
	var rejObj = {
		name: aPromiseName,
		aReason: aReason
	};
	console.error('Rejected - ' + aPromiseName + ' - ', rejObj);
	if (aPromiseToReject) {
		aPromiseToReject.reject(rejObj);
	}
}
function genericCatch(aPromiseName, aPromiseToReject, aCaught) {
	var rejObj = {
		name: aPromiseName,
		aCaught: aCaught
	};
	console.error('Caught - ' + aPromiseName + ' - ', rejObj);
	if (aPromiseToReject) {
		aPromiseToReject.reject(rejObj);
	}
}

/* eslint-enable */