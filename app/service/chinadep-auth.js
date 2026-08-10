'use strict';

const { Service } = require('egg');

class ChinadepAuthService extends Service {
  getHeaders(deviceToken) {
    const { chinadep } = this.app.config;
    const headers = {
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/json;charset=UTF-8',
      'user-agent': chinadep.userAgent,
      referer: `${chinadep.baseUrl}/`,
    };
    if (deviceToken) headers['Tencent-DeviceToken'] = deviceToken;
    return headers;
  }

  async request(url, data, deviceToken) {
    const { app } = this;
    const { chinadep } = app.config;
    try {
      return await app.curl(url, {
        method: 'POST',
        dataType: 'json',
        contentType: 'json',
        data,
        headers: this.getHeaders(deviceToken),
        timeout: chinadep.requestTimeout,
        followRedirect: false,
      });
    } catch (error) {
      app.logger.warn('[chinadep-auth] upstream request failed: %s', error.message);
      return null;
    }
  }

  normalizeLoginResponse(response, mobile) {
    const payload = response && response.data ? response.data : {};
    if (!response) {
      return {
        httpStatus: 502,
        body: { success: false, status: 'upstream_unavailable', message: 'target login service is unavailable' },
      };
    }
    if (response.status !== 200) {
      return {
        httpStatus: 502,
        body: { success: false, status: 'upstream_error', message: 'target login service returned an unexpected status' },
      };
    }

    if (payload.code === 1 || payload.success === true) {
      const data = payload.data || {};
      if (data.livingCheckUrl) {
        return {
          httpStatus: 202,
          body: {
            success: false,
            status: 'challenge_required',
            challengeType: 'living_check',
            challengeUrl: data.livingCheckUrl,
            message: 'complete the target site verification before continuing',
          },
        };
      }

      const token = data.token || data.accessToken || data.access_token;
      if (!token) {
        return {
          httpStatus: 502,
          body: { success: false, status: 'invalid_upstream_response', message: 'target login response did not contain a session token' },
        };
      }

      return {
        httpStatus: 200,
        body: {
          success: true,
          status: 'authenticated',
          session: {
            token,
            userId: data.id || data.userId || null,
            mobile: data.mobile || mobile,
            nickName: data.nickName || data.nickname || null,
            isVerified: Boolean(data.isVerified),
            isBindWallet: Boolean(data.isBindWallet),
          },
        },
      };
    }

    return {
      httpStatus: 401,
      body: {
        success: false,
        status: 'authentication_failed',
        message: payload.msg || payload.message || 'target site rejected the credentials',
        code: payload.status || payload.code || null,
      },
    };
  }

  async sendLoginSms({ mobile, validate, deviceToken }) {
    const { chinadep } = this.app.config;
    const url = `${chinadep.baseUrl}/sm/api/customer/anonymous/sendLoginSms`;
    const response = await this.request(url, {
      captchaId: chinadep.captchaId,
      mobile,
      validate,
    }, deviceToken);
    const payload = response && response.data ? response.data : {};
    if (!response) {
      return { httpStatus: 502, body: { success: false, status: 'upstream_unavailable', message: 'target SMS service is unavailable' } };
    }
    if (response.status !== 200) {
      return { httpStatus: 502, body: { success: false, status: 'upstream_error', message: 'target SMS service returned an unexpected status' } };
    }
    if (payload.code === 1 || payload.success === true) {
      return {
        httpStatus: 200,
        body: {
          success: true,
          status: 'sms_sent',
          message: payload.msg || payload.message || '短信验证码已发送',
          requestId: payload.requestId || null,
        },
      };
    }
    return {
      httpStatus: 422,
      body: {
        success: false,
        status: 'sms_send_failed',
        message: payload.msg || payload.message || '短信验证码发送失败',
        code: payload.status || payload.code || null,
      },
    };
  }

  async loginBySms({ mobile, code, livingCheckReturnUrl, deviceToken }) {
    const { chinadep } = this.app.config;
    const url = `${chinadep.baseUrl}/sm/api/customer/anonymous/registerOrLoginByMobile`;
    const data = { mobile, code };
    if (livingCheckReturnUrl) data.livingCheckReturnUrl = livingCheckReturnUrl;
    return this.normalizeLoginResponse(await this.request(url, data, deviceToken), mobile);
  }

  async loginByPassword({ mobile, password, deviceToken }) {
    const { app } = this;
    const { chinadep } = app.config;
    const url = `${chinadep.baseUrl}/sm/api/api/auth/customerUser/loginByPassword`;
    return this.normalizeLoginResponse(await this.request(url, { mobile, password }, deviceToken), mobile);
  }
}

module.exports = ChinadepAuthService;
