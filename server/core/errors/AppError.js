class AppError extends Error {
    constructor(statusCode, errorCode, message, params = {}) {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.params = params;
    }
}

module.exports = AppError;
