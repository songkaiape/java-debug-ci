import chai from 'chai'
import path from 'path'
import * as utils from './test-utils'
chai.should()
import { ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE } from './constants'
import { assert } from 'chai'
import fs from 'fs'
import os from 'os'
import { execSync } from 'mz/child_process'
let http = require('http')

describe('PetClinic test', () => {
    let config;
    let DATA_ROOT;
    let debugEngine;
    before(function () {
        (() => {
            let projectPath = path.join(ROOT, 'spring-petclinic');
            if (!fs.existsSync(projectPath)) {
                console.log("****", "Clone project");
                let downloadCmd = `cd ${ROOT}` + '&& git clone https://github.com/spring-projects/spring-petclinic.git';
                execSync(downloadCmd, { stdio: [0, 1, 2] });
                console.log("****", "Clone finished");
            }
            else {
                console.log("****", "Project is existed")
            }
            let filePath=path.join(projectPath, 'src', 'main', 'resources','application.properties');
            fs.appendFileSync(filePath,'\nserver.port=8880');

        })();
    });
    beforeEach(function () {
        this.timeout(1000 * 50);
        return (async () => {
            config = new PetClinic();
            DATA_ROOT = path.join(ROOT, config.workspaceRoot);
            debugEngine = await utils.createDebugEngine(DATA_ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE, config);
        })();
    });

    afterEach(() => {
        try {
            debugEngine.disconnect(false);
        } catch (e) {
            console.log("###  ", e);
        }
        return debugEngine.close();
    });

    it('should pass PetClinic test.', function (done) {
        this.timeout(1000 * 50);
        (async () => {
            try {
                await debugEngine.launch();
                if (config.initialBreakpoints) {
                    for (let breakpoint of config.initialBreakpoints) {
                        const breakFile = path.join(DATA_ROOT, config.sourcePath, breakpoint.relativePath);
                        await debugEngine.setBreakpoints(breakFile, breakpoint.lines);
                    }
                }
                // // starting
                await debugEngine.startDebug();
                const terminateEvent = await debugEngine.waitForTerminate();
                console.log('exiting', terminateEvent);
                await utils.timeout(1000);
                done();
            } catch (error) {
                done(error);
                throw error;
            }
        })();
    });
});

class PetClinic {
    get workspaceRoot() {
        return 'spring-petclinic';
    }

    get sourcePath() {
        return 'src/main/java';
    }

    get outputPath() {
        return 'target/classes';
    }

    get initialBreakpoints() {
        return [{
            relativePath: "org/springframework/samples/petclinic/PetClinicApplication.java",

            lines: [32]
        }, {
            relativePath: "org/springframework/samples/petclinic/system/WelcomeController.java",
            lines: [12]

        }];
    }

    get projectName() {
        return "spring-petclinic";
    }

    get mainClass() {
        return "org.springframework.samples.petclinic.PetClinicApplication";
    }

    withEngine(engine) {
        const petClinicbreakpointFile = path.join(engine.cwd, this.sourcePath, this.initialBreakpoints[0].relativePath);
        const welcomeController = path.join(engine.cwd, this.sourcePath, this.initialBreakpoints[1].relativePath);
        const outputList = [];

        engine.registerHandler('breakpoint:*/PetClinicApplication.java:*', async (event, arg1, arg2, detail) => {
            console.log("****", "The Bp on main is hit");
            utils.pathEquals(petClinicbreakpointFile, detail.source.path).should.equal(true);
            console.log('***threads', await engine.threads());
            const scopes = await engine.scopes(detail.id);
            await engine.resume(detail.event.body.threadId);
        });

        engine.registerHandler('output*', (event, arg1, arg2, detail) => {
            detail.category.should.equal('stdout');
            if (detail.output.includes("Started PetClinicApplication")) {
                function getWebPage() {
                    return new Promise((resolve) => {
                        let opts = {
                            url: 'http://localhost',
                            port: "8880"
                        };
                        http.get(opts, (res) => {
                            resolve(res);
                        });

                    });
                }
                (async () => {
                    let data = await getWebPage();
                    console.log("******", "Visit the webpage successfully");
                    assert(data.statusCode === 200);
                    assert(data.headers['content-type'].includes('text/html'));
                    await utils.timeout(1000 * 5);
                    await engine.disconnect(false);
                })();

            }
            outputList.push(detail.output);
            console.log("****", detail.output);
        });

        engine.registerHandler('breakpoint:*/WelcomeController.java:*', async (event, arg1, arg2, detail) => {
            console.log("****", "The Bp on welcome is hit")
            utils.pathEquals(welcomeController, detail.source.path).should.equal(true);
            console.log('***threads', await engine.threads());
            const scopes = await engine.scopes(detail.id);
            await engine.resume(detail.event.body.threadId);

        });

        engine.registerHandler('terminated', () => {
            console.log("Test successfully");
        });

    }
}