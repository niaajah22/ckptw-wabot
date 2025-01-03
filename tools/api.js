// Daftar API gratis, gunakan dengan bijak!
const APIs = {
    agatz: {
        baseURL: "https://api.agatz.xyz"
    },
    btch: {
        baseURL: "https://btch.us.kg"
    },
    devo: {
        baseURL: "https://devo.apibotwa.biz.id"
    },
    fasturl: {
        baseURL: "https://fastrestapis.fasturl.link",
        APIKey: "" // APIKey tidak disediakan, Anda dapat menggunakan APIKey Anda sendiri
    },
    gifted: {
        baseURL: "https://api.gifted.my.id",
        APIKey: "gifted" // APIKey disediakan oleh Gifted Tech
    },
    itzpire: {
        baseURL: "https://itzpire.com"
    },
    nexoracle: {
        baseURL: "https://api.nexoracle.com",
        APIKey: "free_key@maher_apis" // APIKey disediakan oleh Maher Zubair
    },
    nervapi: {
        baseURL: "https://itsreimau-nervapi.hf.space",
        APIKey: "demo" // APIKey disediakan oleh ItsReimau
    },
    nyxs: {
        baseURL: "https://api.nyxs.pw"
    },
    rintohsaka: {
        baseURL: "https://api-rin-tohsaka.vercel.app"
    },
    sandipbaruwal: {
        baseURL: "https://sandipbaruwal.onrender.com"
    },
    siputzx: {
        baseURL: "https://api.siputzx.my.id"
    },
    ssateam: {
        baseURL: "https://api.ssateam.my.id",
        APIKey: "root" // APIKey disediakan oleh Fainshe
    },
    toxicdevil: {
        baseURL: "https://toxicdevilapi.vercel.app"
    },
    vapis: {
        baseURL: "https://vapis.my.id"
    },
    vreden: {
        baseURL: "https://api.vreden.my.id"
    }
};

function createUrl(apiNameOrURL, endpoint, params = {}, apiKeyParamName) {
    try {
        const api = APIs[apiNameOrURL];

        if (!api) {
            const url = new URL(apiNameOrURL);
            apiNameOrURL = url;
        }

        const queryParams = new URLSearchParams(params);

        if (apiKeyParamName && api && "APIKey" in api) {
            queryParams.set(apiKeyParamName, api.APIKey);
        }

        const baseURL = api ? api.baseURL : apiNameOrURL.origin;
        const apiUrl = new URL(endpoint, baseURL);
        apiUrl.search = queryParams.toString();

        return apiUrl.toString();
    } catch (error) {
        console.error(`[${config.pkg.name}] Error:`, error);
        return null;
    }
}

function listUrl() {
    return APIs;
}

module.exports = {
    createUrl,
    listUrl
};