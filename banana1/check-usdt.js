const axios = require('axios');
const colors = require('colors');
const fs = require('fs');
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');

class BananaBot {
    constructor() {
        this.base_url = 'https://interface.carv.io/banana';
        this.headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': 'https://banana.carv.io',
            'Referer': 'https://banana.carv.io/',
            'Sec-CH-UA': '"Not A;Brand";v="99", "Android";v="12"',
            'Sec-CH-UA-Mobile': '?1',
            'Sec-CH-UA-Platform': '"Android"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-site',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Pixel 4 XL) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.73 Mobile Safari/537.36',
            'X-App-ID': 'carv',
        };
    }

    log(msg) {
        console.log(`[*] ${msg}`);
    }

    async login(queryId, proxy) {
        const loginPayload = {
            tgInfo: queryId,
            InviteCode: ""
        };

        try {
            const response = await axios.post(`${this.base_url}/login`, loginPayload, { headers: this.headers, httpsAgent: new HttpsProxyAgent(proxy) });
            await this.sleep(1000);

            const responseData = response.data;
            if (responseData.data && responseData.data.token) {
                return responseData.data.token;
            } else {
                this.log('Không tìm thấy token.');
                return null;
            }
        } catch (error) {
            this.log('Lỗi trong quá trình đăng nhập: ' + error.message);
            return null;
        }
    }

    async processAccount(queryId, proxy) {
        const token = await this.login(queryId, proxy);
        if (token) {
            this.headers['Authorization'] = token;
            this.headers['Cache-Control'] = 'no-cache';
            this.headers['Pragma'] = 'no-cache';

            try {
                const userInfoResponse = await axios.get(`${this.base_url}/get_user_info`, { headers: this.headers, httpsAgent: new HttpsProxyAgent(proxy) });
                this.log(colors.green('Đăng nhập thành công !'));
                await this.sleep(1000);
                const userInfoData = userInfoResponse.data;

                const userInfo = userInfoData.data || {};
                const usdt = userInfo.usdt || 0;

                this.log(colors.green(`USDT : ${colors.white(usdt)}`));
                return usdt >= 1;
            } catch (error) {
                this.log('Không thể tìm nạp thông tin người dùng và danh sách nhiệm vụ do thiếu mã thông báo.');
                return false;
            }
        } else {
            return false;
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    extractUserData(queryId) {
        const urlParams = new URLSearchParams(queryId);
        const user = JSON.parse(decodeURIComponent(urlParams.get('user')));
        return {
            auth_date: urlParams.get('auth_date'),
            hash: urlParams.get('hash'),
            query_id: urlParams.get('query_id'),
            user: user
        };
    }

    countdown(seconds) {
        return new Promise(resolve => {
            let remaining = seconds;
            process.stdout.write(`\r[*] Sẽ khởi động lại sau ${remaining} giây...`);
            const interval = setInterval(() => {
                remaining -= 1;
                process.stdout.write(`\r[*] Sẽ khởi động lại sau ${remaining} giây...`);
                if (remaining <= 0) {
                    clearInterval(interval);
                    process.stdout.write('\n'); // Để chuyển sang dòng mới sau khi hoàn thành
                    resolve();
                }
            }, 1000);
        });
    }

    async main() {
        const dataFile = path.join(__dirname, 'data.txt');
        const userData = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);

        const proxyFile = path.join(__dirname, 'proxy.txt');
        const proxies = fs.readFileSync(proxyFile, 'utf8').split('\n').filter(Boolean);

        let hasUsdtOverOne = false;

        for (let i = 0; i < userData.length; i++) {
            const queryId = userData[i];
            const data = this.extractUserData(queryId);
            const userDetail = data.user;
            const proxy = proxies[i % proxies.length];

            try {
                console.log(`\n========== Tài khoản ${i + 1} | ${userDetail.first_name} ==========`);

                const hasEnoughUsdt = await this.processAccount(queryId, proxy);
                if (hasEnoughUsdt) {
                    hasUsdtOverOne = true;
                }
                await this.sleep(1000);
            } catch (error) {
                this.log('Lỗi khi xử lý tài khoản: ' + error.message);
            }
        }

        if (!hasUsdtOverOne) {
            this.log('Thưa đại nhân không có tài khoản nào có số dư usdt trên 1');
        } else {
            this.log('Có tài khoản có số dư usdt trên 1');
        }

        console.log('[*] Hoàn thành tất cả các tài khoản.');
        await this.countdown(120); // Đếm ngược 120 giây (2 phút)
        this.main(); // Gọi lại hàm main
    }
}

const bot = new BananaBot();
bot.main();
