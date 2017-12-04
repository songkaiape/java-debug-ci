import chai from 'chai'
import path from 'path'
import * as utils from './test-utils'
chai.should();
import { ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE } from './constants';
import http from 'http';
import request from 'request';
import syncRequest from 'sync-request';
let randomStr=Math.random().toString(36).substr(2, 5);
describe('HelloWorld test', () => {
    let config;
    let DATA_ROOT;
    let debugEngine;
    beforeEach(function () {
        this.timeout(1000 * 40);
        return (async () => {
            config = new HelloWorld();
            DATA_ROOT = path.join(ROOT, config.workspaceRoot);
            debugEngine = await utils.createDebugEngine(DATA_ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE, config);
        })();
    });

    afterEach(() => {
        return debugEngine.close();
    });

    it('should pass HelloWorld test.', function (done) {
        this.timeout(1000 * 40);
        (async () => {
            try {
                await debugEngine.launch();
                if (config.initialBreakpoints) {
                    for (let breakpoint of config.initialBreakpoints) {
                        const breakFile = path.join(DATA_ROOT, config.sourcePath, breakpoint.relativePath);
                        let temp=await debugEngine.setBreakpoints(breakFile, breakpoint.lines);
                        console.log("$#$$$$#$#$",temp);
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

class HelloWorld {
    get workspaceRoot() {
        return '24.todoapp';
    }

    get mainClass() {
        return 'com/microsoft/azure/sample/TodoApplication';
    }

    get sourcePath() {
        return 'src/main/java';
    }

    get outputPath() {
        return 'target/classes';
    }

    get projectName() {
        return 'todo-app-java-on-azure';
    }
    get initialBreakpoints() {
        return [
            {
                relativePath: 'com/microsoft/azure/sample/TodoApplication.java',
                lines: [15]
            }
            ,
            {
                relativePath:'com/microsoft/azure/sample/controller/TodoListController.java',
                lines: [69]
            }
            
        ];
    }

    withEngine(engine) {
        const outputList = [];
        let url = "http://localhost:8080";
        let postData = {
            "description": "Breakfast"+randomStr,
            "owner": "barney",
            "finish": "false"
        };
        let getRequest = {
            url: url + '/api/todolist',
            port: 8080,
            method: 'GET'
        };
        let postRequest = {
            url: url + '/api/todolist',
            port: 8080,
            method: 'POST',
            body: postData,
            json: true
        };
        engine.registerHandler('breakpoint:*/TodoApplication.java:*', async (event, arg1, arg2, detail) => {
            const breakpointFile = path.join(engine.cwd, this.sourcePath, 'com/microsoft/azure/sample/TodoApplication.java');
            const expectedLines = [15];
            utils.pathEquals(breakpointFile, detail.source.path).should.equal(true);
            console.log("#######breakPoint:15");
            console.log('***threads', await engine.threads());
            const scopes = await engine.scopes(detail.id);
            

            await engine.resume(detail.event.body.threadId);
           
            

        });
        engine.registerHandler('breakpoint:*/TodoListController.java:*', async (event, arg1, arg2, detail) => {
            const breakpointFile = path.join(engine.cwd, this.sourcePath, 'com/microsoft/azure/sample/controller/TodoListController.java');
            const expectedLines = [69];
            console.log("#######breakPoint:69");

            

            utils.pathEquals(breakpointFile, detail.source.path).should.equal(true);

            //await engine.stepOut(detail.event.body.threadId);



            await engine.resume(detail.event.body.threadId);
            console.log("ReadyToGet");
            let getRes = syncRequest('GET', 'http://localhost:8080/api/todolist');
            let getResBody=JSON.parse(getRes.getBody('utf8'));
            console.log(getResBody);
            let descriptions=[];
            for(let index in getResBody){
              descriptions.push(getResBody[index].description);
              }
            console.log(descriptions);
            let find=descriptions.indexOf("Breakfast"+randomStr)>=0;
            console.log(find);
            find.should.equal(true);
            //engine.promiseResolve('terminated');
            //engine.close();
            engine.debugClient.emit('terminated');
           
        });

        engine.registerHandler('output*', (event, arg1, arg2, detail) => {
            //detail.category.should.equal('stdout');
            outputList.push(detail.output);
            console.log("****", detail.output);
            if(detail.output.includes("Started TodoApplication"))
            {
                console.log("send request to hit second BP");
                request(postRequest, function (err, res, body) {
                    if (!err) {
                      console.log(res.body);
                      
                    }
                });
                /*
                let postRes=syncRequest('POST',"http://localhost:8080/api/todolist",{
                    json:postData
                  });
                  
                console.log(postRes.getBody('utf8'));
                */
            
            }
                
            
        });
        engine.registerHandler('terminated', () => {
            //linePos.should.equal(expectedLines.length);
            //utils.equalsWithoutLineEnding(outputList.join(''), '');
        });
    }
}