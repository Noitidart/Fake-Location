// requires browser window object

export function getBrowser() {
    function getBrowserInner() {
        // http://stackoverflow.com/a/2401861/1828637
        var ua= navigator.userAgent, tem,
        M= ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
        if(/trident/i.test(M[1])){
            tem=  /\brv[ :]+(\d+)/g.exec(ua) || [];
            return 'IE '+(tem[1] || '');
        }
        if(M[1]=== 'Chrome'){
            tem= ua.match(/\b(OPR|Edge)\/(\d+)/);
            if(tem !== null) return tem.slice(1).join(' ').replace('OPR', 'Opera');
        }
        M= M[2]? [M[1], M[2]]: [navigator.appName, navigator.appVersion, '-?'];
        if((tem= ua.match(/version\/(\d+)/i)) !== null) M.splice(1, 1, tem[1]);
        return M.join(' ');
    }

    var name_version_str = getBrowserInner();
    var split = name_version_str.split(' ');
    var version = split.pop();
    var name = split.join(' ');
    return {
        name: name.toLowerCase(),
        nameproper: name,
        version: version
    };
}