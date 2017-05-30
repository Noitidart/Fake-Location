class awaitable {
    constructor(xhr) {
        this.xhr = xhr;
    }
    json() {
        return new Promise(resolve => resolve(JSON.parse(this.xhr.responseText)))
    }
    text() {
        return new Promise(resolve => resolve(this.xhr.responseText))
    }
}
export default function fetch(url) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.responseType = 'text';
        xhr.onload = () => {
            // console.log(xhr.responseText);
            resolve(new awaitable(xhr));
        };
        xhr.onerror = () => {
            reject('failed');
        };
        xhr.onabort = () => {
            reject('aborted');
        };
        xhr.open("GET", url);
        xhr.send();
    })
}