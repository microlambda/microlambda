"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const sinon_1 = require("sinon");
const fs_1 = tslib_1.__importDefault(require("fs"));
const projectRoot = tslib_1.__importStar(require("./get-project-root"));
const logger_1 = require("./logger");
const errors_1 = require("./errors");
describe('[method] findProjectRoot', () => {
    const stubs = {};
    beforeEach(() => {
        stubs.cwd = sinon_1.stub(process, 'cwd');
        stubs.existSync = sinon_1.stub(fs_1.default, 'existsSync');
        stubs.existSync.returns(false);
        stubs.existSync.withArgs('/users/john/project-1/lerna.json').returns(true);
    });
    afterEach(() => {
        stubs.cwd.restore();
        stubs.existSync.restore();
    });
    it('should find project root at project root', () => {
        stubs.cwd.returns('/users/john/project-1');
        expect(projectRoot.findProjectRoot()).toBe('/users/john/project-1');
    });
    it('should find project root in a nested directory', () => {
        stubs.cwd.returns('/users/john/project-1/packages/utils/src');
        expect(projectRoot.findProjectRoot()).toBe('/users/john/project-1');
    });
    it('should throw if not a microlambda project', () => {
        stubs.cwd.returns('/users/john/project-2');
        try {
            projectRoot.findProjectRoot();
        }
        catch (e) {
            expect(e.code).toBe(errors_1.MilaErrorCode.NOT_IN_A_VALID_LERNA_PROJECT);
        }
    });
});
describe('[method] getProjectRoot', () => {
    let findProjectRoot;
    let exit;
    let consoleError;
    beforeEach(() => {
        findProjectRoot = sinon_1.stub(projectRoot, 'findProjectRoot');
        exit = sinon_1.stub(process, 'exit');
        consoleError = sinon_1.stub(console, 'error');
    });
    afterEach(() => {
        findProjectRoot.restore();
        exit.restore();
        consoleError.restore();
    });
    it('should find project', () => {
        findProjectRoot.returns('/users/john/project-1');
        expect(projectRoot.getProjectRoot(new logger_1.Logger())).toBe('/users/john/project-1');
    });
    it('should exit 1 and print error message if not in a valid mila project', () => {
        const e = new errors_1.MilaError(errors_1.MilaErrorCode.NOT_IN_A_VALID_LERNA_PROJECT);
        findProjectRoot.throws(e);
        projectRoot.getProjectRoot(new logger_1.Logger());
        expect(exit.callCount).toBe(1);
        expect(consoleError.callCount).toBe(1);
        expect(exit.getCalls()[0].args).toEqual([1]);
    });
    it('should exit 1 and print error message if any error occurs while resolving project root', () => {
        findProjectRoot.throws(new Error('fs error'));
        projectRoot.getProjectRoot(new logger_1.Logger());
        expect(exit.callCount).toBe(1);
        expect(consoleError.callCount).toBe(2);
        expect(exit.getCalls()[0].args).toEqual([1]);
    });
});
//# sourceMappingURL=get-project-root.spec.js.map