var gBgComm = new Comm.client.webextports('tab');

// this is how to do it without CommHelper
var callInBackground = Comm.callInX2.bind(null, gBgComm, null, null);
// var callInExe = Comm.callInX2.bind(null, gBgComm, 'callInExe', null);

var callInBootstrap = Comm.callInX2.bind(null, gBgComm, 'callInBootstrap', null);
// var callInMainworker = Comm.callInX2.bind(null, gBgComm, 'callInMainworker', null);
