// ==UserScript==
// @name         IndiaPlace Bot
// @namespace    https://github.com/sudo-Mystic/IndiaPlace
// @version      23
// @description  Bot for r/IndiaPlace!
// @author       NoahvdAa
// @match        https://www.reddit.com/r/place/*
// @match        https://new.reddit.com/r/place/*
// @connect      reddit.com
// @connect      commando.burgmoment.repl.co
// @icon         https://www.google.com/s2/favicons?sz=64&domain=reddit.com
// @require	     https://cdn.jsdelivr.net/npm/toastify-js
// @resource     TOASTIFY_CSS https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css
// @updateURL    https://github.com/PlaceIndia/Bot/raw/master/placenlbot.user.js
// @downloadURL  https://github.com/PlaceIndia/Bot/raw/master/placenlbot.user.js
// @grant        GM_getResourceText
// @grant        GM_addStyle
// @grant        GM.xmlHttpRequest
// ==/UserScript==


const VERSION = 19;
const BACKEND_URL = 'indiaplace-commandserver.onrender.com';
const BACKEND_API_WS_URL = `wss://${BACKEND_URL}/api/ws`;
const BACKEND_API_MAPS = `https://${BACKEND_URL}/maps`;

let socket;
let order;
let accessToken;
let pixelsPlaced = 0;
let currentOrderCanvas = document.createElement('canvas');
let currentOrderCtx = currentOrderCanvas.getContext('2d');
let currentPlaceCanvas = document.createElement('canvas');

const DEFAULT_TOAST_DURATION_MS = 10000;
const COLOR_MAPPINGS = {
    '#6D001A': 0,
    '#BE0039': 1,
    '#FF4500': 2,
    '#FFA800': 3,
    '#FFD635': 4,
    '#FFF8B8': 5,
    '#00A368': 6,
    '#00CC78': 7,
    '#7EED56': 8,
    '#00756F': 9,
    '#009EAA': 10,
    '#00CCC0': 11,
    '#2450A4': 12,
    '#3690EA': 13,
    '#51E9F4': 14,
    '#493AC1': 15,
    '#6A5CFF': 16,
    '#94B3FF': 17,
    '#811E9F': 18,
    '#B44AC0': 19,
    '#E4ABFF': 20,
    '#DE107F': 21,
    '#FF3881': 22,
    '#FF99AA': 23,
    '#6D482F': 24,
    '#9C6926': 25,
    '#FFB470': 26,
    '#000000': 27,
    '#515252': 28,
    '#898D90': 29,
    '#D4D7D9': 30,
    '#FFFFFF': 31
};

const UA_PREFIXES = [
    "firefox",
    "chrome",
    "edg"
];

const getRealWork = rgbaOrder => {
    let order = [];
    for (var i = 0; i < 3000 * 2000; i++) {
        if (rgbaOrder[(i * 4) + 3] !== 0) {
            order.push(i);
        }
    }
    return order;
};

const getPendingWork = (work, rgbaOrder, rgbaCanvas) => {
    let pendingWork = [];
    for (const i of work) {
        if (rgbaOrderToHex(i, rgbaOrder) !== rgbaOrderToHex(i, rgbaCanvas)) {
            pendingWork.push(i);
        }
    }
    return pendingWork;
};

(async function () {
    GM_addStyle(GM_getResourceText('TOASTIFY_CSS'));

    currentOrderCanvas.width = 3000;
    currentOrderCanvas.height = 2000;
    currentOrderCanvas.style.display = 'none';
    currentOrderCanvas = document.body.appendChild(currentOrderCanvas);

    currentPlaceCanvas.width = 3000;
    currentPlaceCanvas.height = 2000;
    currentPlaceCanvas.style.display = 'none';
    currentPlaceCanvas = document.body.appendChild(currentPlaceCanvas);

    window.placeCanvas = currentPlaceCanvas
    window.orderCanvas = currentOrderCanvas

    Toastify({
        text: 'Getting Access Token...',
        duration: DEFAULT_TOAST_DURATION_MS
    }).showToast();
    accessToken = await getAccessToken();
    Toastify({
        text: 'Access Token Received!',
        duration: DEFAULT_TOAST_DURATION_MS
    }).showToast();

    connectSocket();
    attemptPlace();

    setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN)
            socket.send(JSON.stringify({ type: 'ping' }));
    }, 5000);

    setInterval(async () => {
        accessToken = await getAccessToken();
    }, 30 * 60 * 1000);
})();

function connectSocket() {
    Toastify({
        text: 'Connecting to IndiaPlace Server',
        duration: DEFAULT_TOAST_DURATION_MS
    }).showToast();

    socket = new WebSocket(BACKEND_API_WS_URL);

    const errorTimeout = setTimeout(() => {
        Toastify({
            text: 'Error while connecting to server',
            duration: DEFAULT_TOAST_DURATION_MS
        }).showToast();
        console.error('Error when trying to connect to the IndiaPlace server!');
    }, 5000);

    socket.addEventListener('open', function () {
        clearTimeout(errorTimeout);
        Toastify({
            text: 'Connected to IndiaPlace Server!',
            duration: DEFAULT_TOAST_DURATION_MS
        }).showToast();
        socket.send(JSON.stringify({ type: 'getmap' }));
        socket.send(JSON.stringify({ type: "brand", brand: `userscript${getPrefix()}V${VERSION}` }));
    });

    socket.onmessage = async function (message) {
        var data;
        try {
            data = JSON.parse(message.data);
        } catch (e) {
            return;
        }

        switch (data.type.toLowerCase()) {
            case 'map':
                Toastify({
                    text: `New Order Ready!${data?.reason ? "\nReason: " + data.reason : ""}${data?.uploader ? "\nUploaded: " + data.uploader : ""}`,
                    duration: DEFAULT_TOAST_DURATION_MS
                }).showToast();
                currentOrderCtx = await getCanvasFromUrl(`${BACKEND_API_MAPS}/${data.data}`, currentOrderCanvas);
                order = getRealWork(currentOrderCtx.getImageData(0, 0, 3000, 2000).data);
                Toastify({
                    text: `New Map Loaded, Total: ${order.length} pixels!`,
                    duration: DEFAULT_TOAST_DURATION_MS
                }).showToast();
                mapEmitter.dispatchEvent(new CustomEvent('map'))
                break;
            case 'toast':
                Toastify({
                    text: `Message from Server: ${data.message}`,
                    duration: data.duration || DEFAULT_TOAST_DURATION_MS,
                    style: data.style || {}
                }).showToast();
                break;
            default:
                break;
        }
    };

    socket.onclose = function (e) {
        Toastify({
            text: `Disconnected from IndiaPlace Server${e?.reason ? ": " + e.reason : "."}`,
            duration: DEFAULT_TOAST_DURATION_MS
        }).showToast();
        console.error('Socket Error: ', e.reason);

        socket.close();
        setTimeout(connectSocket, 1000);
    };
}

let mapEmitter = new EventTarget();


async function attemptPlace() {
    order = null
    if (socket.readyState == 1) {
        socket.send(JSON.stringify({ type: 'getmap' }));
    } else {
        socket.addEventListener('open', attemptPlace, {once: true})
        return
    }



    mapEmitter.addEventListener('map', () => console.log("New Map"))

    mapEmitter.addEventListener('map', async () => {
        if (order == undefined || order == null) {
            setTimeout(attemptPlace, 2000); // try again in 2sec.
            return;
        }

        let ctx;
        ctx = await getCanvasFromUrl(await getCurrentImageUrl('0'), currentPlaceCanvas, 0, 0, 0);
        ctx = await getCanvasFromUrl(await getCurrentImageUrl('1'), currentPlaceCanvas, 1, 1000, 0); // Expanze 1
        ctx = await getCanvasFromUrl(await getCurrentImageUrl('2'), currentPlaceCanvas, 2, 2000, 0); // Expanze 2
        ctx = await getCanvasFromUrl(await getCurrentImageUrl('3'), currentPlaceCanvas, 3, 0, 1000); // Expanze 3
        ctx = await getCanvasFromUrl(await getCurrentImageUrl('4'), currentPlaceCanvas, 4, 1000, 1000); // Expanze 3
        ctx = await getCanvasFromUrl(await getCurrentImageUrl('5'), currentPlaceCanvas, 5, 2000, 1000); // Expanze 3

        const rgbaOrder = currentOrderCtx.getImageData(0, 0, 3000, 2000).data;
        const rgbaCanvas = ctx.getImageData(0, 0, 3000, 2000).data;

        var download = function (c) {
            var link = document.createElement('a');
            link.download = 'filename.png';
            link.href = c.toDataURL()
            link.click();
        }


        const work = getPendingWork(order, rgbaOrder, rgbaCanvas);

        if (work.length === 0) {
            Toastify({
                text: `All the pixels are already in the right place! Try again in 30 seconds...`,
                duration: 30000
            }).showToast();
            setTimeout(attemptPlace, 30000); // trying in 30 sec
            return;
        }

        const percentComplete = 100 - Math.ceil(work.length * 100 / order.length);
        const workRemaining = work.length;
        const idx = Math.floor(Math.random() * work.length);
        const i = work[idx];


        const x = i % 3000;
        const y = Math.floor(i / 3000);
        const hex = rgbaOrderToHex(i, rgbaOrder);

        Toastify({
            text: `Attempting to place pixel on ${x - 1500}, ${y - 1000}...\n${percentComplete}% Completed, ${workRemaining} Remains.`,
            duration: DEFAULT_TOAST_DURATION_MS
        }).showToast();

        const res = await place(x, y, COLOR_MAPPINGS[hex]);
        const data = await res.json();
        try {
            if (data.errors) {
                const error = data.errors[0];
                const nextPixel = error.extensions.nextAvailablePixelTs + (3500 + Math.floor(Math.random() * 5000));
                const nextPixelDate = new Date(nextPixel);
                const delay = nextPixelDate.getTime() - Date.now();
                const toastDuration = delay > 0 ? delay : DEFAULT_TOAST_DURATION_MS;

                Toastify({
                    text: `Pixel placed too soon.\nThe next pixel will be placed in ${nextPixelDate.toLocaleTimeString('en-US')}.`,
                    duration: toastDuration
                }).showToast();
                setTimeout(attemptPlace, delay);
            } else {
                const nextPixel = data.data.act.data[0].data.nextAvailablePixelTimestamp + (3500 + Math.floor(Math.random() * 10000));
                // Přidejte náhodný čas mezi 0 a 10 s, abyste zabránili detekci a šíření po restartu serveru.
                const nextPixelDate = new Date(nextPixel);
                const delay = nextPixelDate.getTime() - Date.now();
                const toastDuration = delay > 0 ? delay : DEFAULT_TOAST_DURATION_MS;
                pixelsPlaced++;

                Toastify({
                    text: `Pixel laid on ${x - 1500}, ${y - 1000}!\nPixel laid: ${pixelsPlaced}\nThe next pixel will be placed in ${nextPixelDate.toLocaleTimeString('en-US')}.`,
                    duration: toastDuration
                }).showToast();
                setTimeout(attemptPlace, delay);
            }
        } catch (e) {
            console.warn('Error Processing response: ', e);
            Toastify({
                text: `Error Processing Response: ${e}.`,
                duration: DEFAULT_TOAST_DURATION_MS
            }).showToast();
            setTimeout(attemptPlace, 10000);
        }
    }, { once: true })
}

function place(x, y, color) {
    socket.send(JSON.stringify({ type: 'placepixel', x, y, color }));



    let canvasIndex = Math.floor(x / 1000) + (y > 1000 ? 3 : 0)
    x = x % 1000
    y = (y % 1000)

    return fetch('https://gql-realtime-2.reddit.com/query', {
        method: 'POST',
        body: JSON.stringify({
            'operationName': 'setPixel',
            'variables': {
                'input': {
                    'actionName': 'r/replace:set_pixel',
                    'PixelMessageData': {
                        'coordinate': {
                            'x': x,
                            'y': y
                        },
                        'colorIndex': color,
                        'canvasIndex': canvasIndex
                    }
                }
            },
            'query': 'mutation setPixel($input: ActInput!) {\n  act(input: $input) {\n    data {\n      ... on BasicMessage {\n        id\n        data {\n          ... on GetUserCooldownResponseMessageData {\n            nextAvailablePixelTimestamp\n            __typename\n          }\n          ... on SetPixelResponseMessageData {\n            timestamp\n            __typename\n          }\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n'
        }),
        headers: {
            'origin': 'https://hot-potato.reddit.com',
            'referer': 'https://hot-potato.reddit.com/',
            'apollographql-client-name': 'mona-lisa',
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });
}

async function getAccessToken() {
    const usingOldReddit = window.location.href.includes('new.reddit.com');
    const url = usingOldReddit ? 'https://new.reddit.com/r/place/' : 'https://www.reddit.com/r/place/';
    const response = await fetch(url);
    const responseText = await response.text();
    return responseText.split('\"accessToken\":\"')[1].split('"')[0];
}

async function getCurrentImageUrl(id = '0') {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket('wss://gql-realtime-2.reddit.com/query', 'graphql-ws');

        ws.onopen = () => {
            ws.send(JSON.stringify({
                'type': 'connection_init',
                'payload': {
                    'Authorization': `Bearer ${accessToken}`
                }
            }));
            ws.send(JSON.stringify({
                'id': '1',
                'type': 'start',
                'payload': {
                    'variables': {
                        'input': {
                            'channel': {
                                'teamOwner': 'GARLICBREAD',
                                'category': 'CANVAS',
                                'tag': id
                            }
                        }
                    },
                    'extensions': {},
                    'operationName': 'replace',
                    'query': 'subscription replace($input: SubscribeInput!) {\n  subscribe(input: $input) {\n    id\n    ... on BasicMessage {\n      data {\n        __typename\n        ... on FullFrameMessageData {\n          __typename\n          name\n          timestamp\n        }\n      }\n      __typename\n    }\n    __typename\n  }\n}'
                }
            }));
        };

        ws.onmessage = (message) => {
            const { data } = message;
            const parsed = JSON.parse(data);


            if (!parsed.payload || !parsed.payload.data || !parsed.payload.data.subscribe || !parsed.payload.data.subscribe.data) return;

            ws.close();
            resolve(parsed.payload.data.subscribe.data.name + `?noCache=${Date.now() * Math.random()}`);
        };

        ws.onerror = reject;
    });
}

function getCanvasFromUrl(url, canvas, canvasId = 0, x = 0, y = 0, clearCanvas = false) {
    return new Promise((resolve, reject) => {
        let loadImage = ctx => {
            GM.xmlHttpRequest({
                method: "GET",
                url: url,
                responseType: 'blob',
                onload: function (response) {
                    var urlCreator = window.URL || window.webkitURL;
                    var imageUrl = urlCreator.createObjectURL(this.response);
                    var img = new Image();
                    img.onload = () => {
                        if (clearCanvas) {
                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                        }

                        ctx.drawImage(img, x, y);
                        resolve(ctx);
                    };
                    img.onerror = () => {
                        resolve(ctx)
                    };
                    img.src = imageUrl;
                },
            });
        };
        loadImage(canvas.getContext('2d'));
    });
}

function getPrefix() {
    let ua = window.navigator.userAgent.toLowerCase();
    let prefix = "";

    UA_PREFIXES.forEach(uaPrefix => {
        if (ua.includes(uaPrefix)) prefix = `-${uaPrefix}-`;
    });

    return prefix;
}

function getCanvas(x, y) {
    if (x <= 999) return y <= 999 ? 0 : 2;
    else return y <= 999 ? 1 : 3;
}

function rgbToHex(r, g, b) {
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

async function placePixel23(x, y, colorId, canvasIndex = 1) {
    const payload = `
    {
  "operationName": "setPixel",
  "variables": {
    "input": {
      "actionName": "r/replace:set_pixel",
      "PixelMessageData": {
        "coordinate": {
          "x": ${x},
          "y": ${y}
        },
        "colorIndex": ${colorId},
        "canvasIndex": ${canvasIndex}
      }
    }
  },
  "query": "mutation setPixel($input: ActInput!) {\n  act(input: $input) {\n    data {\n      ... on BasicMessage {\n        id\n        data {\n          ... on GetUserCooldownResponseMessageData {\n            nextAvailablePixelTimestamp\n            __typename\n          }\n          ... on SetPixelResponseMessageData {\n            timestamp\n            __typename\n          }\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n"
}`

    let a = await fetch({
        host: "https://gql-realtime-2.reddit.com/query", headers: {
            Authorization: `Bearer ${accessToken}`,
            'origin': 'https://hot-potato.reddit.com',
            'referer': 'https://hot-potato.reddit.com/',
            'apollographql-client-name': 'mona-lisa',

            'Content-Type': 'application/json'
        }, body: payload, method: "POST"
    })
}

let rgbaOrderToHex = (i, rgbaOrder) =>
    rgbToHex(rgbaOrder[i * 4], rgbaOrder[i * 4 + 1], rgbaOrder[i * 4 + 2]);
