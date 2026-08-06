'use strict';

const { Service } = require('egg');

class ChinadepAuthService extends Service {
  async loginByPassword({ mobile, password, deviceToken }) {
    const { app } = this;
    const { chinadep } = app.config;
    const url = `${chinadep.baseUrl}/sm/api/api/auth/customerUser/loginByPassword`;
    const headers = {
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/json;charset=UTF-8',
      'user-agent': chinadep.userAgent,
      referer: `${chinadep.baseUrl}/`,
    };

    if (deviceToken) {
      headers['Tencent-DeviceToken'] = deviceToken;
    }

    let response;
    try {
      response = await app.curl(url, {
        method: 'POST',
        dataType: 'json',
        contentType: 'json',
        data: { mobile, password },
        headers,
        timeout: chinadep.requestTimeout,
        followRedirect: false,
      });
    } catch (error) {
      app.logger.warn('[chinadep-auth] upstream request failed: %s', error.message);
      return {
        httpStatus: 502,
        body: {
          success: false,
          status: 'upstream_unavailable',
          message: 'target login service is unavailable',
        },
      };
    }

    const payload = response && response.data ? response.data : {};
    if (response.status !== 200) {
      return {
        httpStatus: 502,
        body: {
          success: false,
          status: 'upstream_error',
          message: 'target login service returned an unexpected status',
        },
      };
    }

    if (payload.code === 1) {
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

      if (!data.token) {
        return {
          httpStatus: 502,
          body: {
            success: false,
            status: 'invalid_upstream_response',
            message: 'target login response did not contain a session token',
          },
        };
      }

      return {
        httpStatus: 200,
        body: {
          success: true,
          status: 'authenticated',
          session: {
            token: data.token,
            userId: data.id,
            mobile: data.mobile || mobile,
            nickName: data.nickName || null,
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
}

module.exports = ChinadepAuthService;
