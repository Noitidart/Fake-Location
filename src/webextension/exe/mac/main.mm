// g++ -framework Cocoa -framework Foundation -framework Carbon -framework AppKit -std=c++11 -o profilist main.mm
// this does not work - gcc -framework Cocoa -framework Foundation -framework Carbon -framework AppKit -lstdc++ -o profilist profilist.mm
#define MAC64

#import <Cocoa/Cocoa.h>
#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>
#import <Carbon/Carbon.h>
// #import <AVFoundation/AVFoundation.h>

#include <sys/types.h> // for getParentProcessInfo

// my personal headers
#include "json.hpp"

// my namespaces
using json = nlohmann::json;

// globals
json core;

// start - debug
#include <utility>
#include <fstream>
#include <string>
#include <chrono> // debug time

template <typename HeadType> bool
debug_log_rec(std::ostream& out, HeadType&& head) {
  out << head;
  out << std::endl;
  return true;
}

template <typename HeadType, typename... TailTypes> bool
debug_log_rec(std::ostream& out, HeadType&& head, TailTypes&&... tails) {
  out << head;
  out << " ";
  debug_log_rec(out, std::forward<TailTypes>(tails)...);
  return true;
}

template <typename... ArgTypes> bool
debug_log(ArgTypes&&... args) {
  std::fstream fs;
  fs.open("/Users/noida/Desktop/log.txt", std::fstream::app);
  debug_log_rec(fs, std::forward<ArgTypes>(args)...);
  fs.close();
  return true;
}

int nowms() {
	using namespace std::chrono;
	milliseconds ms = duration_cast<milliseconds>(system_clock::now().time_since_epoch());
	return ms.count();
}
// end - debug

// start - cmn
// trim - http://stackoverflow.com/a/217605/1828637 - i removed the static inline though because i hear its bad here - http://stackoverflow.com/q/10876930/1828637
#include <algorithm>
#include <functional>
#include <cctype>
#include <locale>

void ltrim(std::string &s) {
    s.erase(s.begin(), std::find_if(s.begin(), s.end(),
            std::not1(std::ptr_fun<int, int>(std::isspace))));
}

// trim from end (in place)
void rtrim(std::string &s) {
    s.erase(std::find_if(s.rbegin(), s.rend(),
            std::not1(std::ptr_fun<int, int>(std::isspace))).base(), s.end());
}

// trim from both ends (in place)
void trim(std::string &s) {
    ltrim(s);
    rtrim(s);
}

// unixCmd
std::string unixCmd(std::string cmd) {
	std::string outstr = "";
	// FILE *pipe = popen("lsof -p " + core["parent"]["pid"] + " | grep \"lock\"", "r");

	FILE *pipe = popen(cmd.c_str(), "r");

	if (!pipe) {
		// debug_log("failed popen, errno:", errno);
	} else {
		while(feof(pipe) == 0) { // returns non-zero if reached eof
			char buf[1024];
			size_t len = fread(buf, 1, sizeof(buf), pipe);
			if (len != 0) {
				// something was read
				outstr += buf;
			}
		}

		pclose(pipe);
	}

	return outstr;
}

// parseLsof
json parseLsof(std::string str) {
	json rez = json::array();

	json headers{ json::array() };
		// [ {name:'BLAH', min:0, max:0} ] // min max are indexes (1 col padding exclusive) (pad can be on both sides if in middle, or if first entry one on right, or if last entry then one on left)
	bool hdone = false; // header_done
	std::string word{ "" }; // current_word

	std::string::size_type lnstix{ 0 }; // line_start_index

	std::string::size_type ix{ 0 }; // ix throughout the whole string. its `i`
	std::string::size_type lnix{ 0 }; // ix on line offset by line start ix

	const char CHAR_N{ '\n' };
	const char CHAR_B{ ' ' };

	bool loopstarted = false;

	json entry = json::object();
	std::string::size_type hix{ 0 }; // header_index_currently_filling

	std::string::size_type LAST_CHAR_N{ str.find_last_of(CHAR_N) }; // line_index
	if (LAST_CHAR_N == std::string::npos) {
		// no new line char
		return rez;
	} else {
		LAST_CHAR_N += 1;
	}

	for(char& c : str) {
		if (loopstarted) ix++;
		if (!loopstarted) loopstarted = true;
		if (ix == LAST_CHAR_N) break; // as the lsof output ends in "\n0\u000b\u0001". I'm not sure about the final 3 chars, but at least the final "\n" sounds right

		// debug_log(ix, c);

		if (!hdone) {
			// space or \n means end of name
			if (c == CHAR_N || c == CHAR_B) {
				if (word.length()) {

					std::string::size_type min;
					std::string::size_type max;

					if (headers.size() == 0) {
						min = 0;
					} else {
						min = ix - word.length();
					}

					max = ix - 1;

					headers.push_back({
						{"name", word},
						{"min", min},
						{"max", max}
					});
					word = "";
				}
			} else {
				word += c;
			}

			if (c == CHAR_N) {
				hdone = true;
				lnstix = ix + 1;
				headers[headers.size()-1]["max"] = ix - 1;
			}
		} else {
			lnix = ix - lnstix;
			// debug_log( headers[hix]["name"], static_cast<int>(headers[hix]["min"]) );
			if (c == CHAR_N) {
				// start of block-link29393
				if (word.length()) {
					std::string cname = (headers[hix]["name"]);
					trim(word);
					entry[cname] = word;
					word = "";
					if (hix < headers.size()) hix++;
				}
				// end block-link29393
				for (int a_hix=hix; a_hix<headers.size(); a_hix++) {
					// hix is definitely NEXT, because if word had length then it was incremented ELSE word was blank so no work field added to entry for this
					std::string cname = (headers[a_hix]["name"]);
					entry[cname] = "";
				}
				rez.push_back(entry);
				entry.clear();
				hix = 0;
				lnstix = ix + 1;
			} else {
				std::string::size_type cmin = static_cast<int>(headers[hix]["min"]);
				std::string::size_type cmax = static_cast<int>(headers[hix]["max"]);

				if (lnix >= cmin && lnix <= cmax) {
					word += c;
				} else if (lnix > cmax) {
					char end_char = (hix == headers.size() - 1) ? CHAR_N : CHAR_B;

					if (c != end_char) {
						word += c;
						headers[hix]["max"] = lnix;
					} else {
						// copy of block-link29393
						if (word.length()) {
							std::string cname = (headers[hix]["name"]);
							trim(word);
							entry[cname] = word;
							word = "";
							if (hix < headers.size()) hix++;
						}
						// end block-link29393
					}
				} else if (lnix < cmin) {
					if (c != CHAR_B) {
						word += c;
						headers[hix]["min"] = lnix;
					}
				}
			}
		}
	}

	debug_log("headers:", headers.dump());
	debug_log("rez:", rez.dump());

	return rez;
}
// end - cmn

// start - strcast
NSString* charToNSString(char * c){
    return [NSString stringWithUTF8String:c];
}

const char* NSStringToChar(NSString *str){
    return [str UTF8String];
}
// end - strcast

// start - comm
#include <functional> // included in comm.h
#include <thread>

// #define WM_COMM WM_USER + 101

using CommCallbackFnPtr = std::function<void(json)>; // typedef void(*CommCallbackFnPtr)(json);
using ReportProgressFnPtr = std::function<void(json)>; // typdef void(*ReportProgressFnPtr)(json);
using ResolveFnPtr = std::function<void(json)>; // typdef  void(*ResolveFnPtr)(json);

typedef void(*CommFuncFnPtr)(json, ReportProgressFnPtr, ResolveFnPtr);

class Comm {
public:
	std::map<std::string, CommFuncFnPtr> gCommScope;

	Comm() : thd(nullptr) {

		bool sent = send_message("\"CONNECT_CONFIRMATION\""); // crossfile-link994844
		debug_log("sent:", sent);

	}

	~Comm() {
		if (thd) {
			thd->join(); // `join` waits for the thread to be terminated
			delete thd;
		}
	}

	void start() {
		// aMainEventLoopId - what to "post message" to, to get the main event loop to see this

		// send_message("\"CONNECT_CONFIRMATION\""); // crossfile-link994844

		// on construct, start the thread and start listening
		thd = new std::thread([&]() {
			// void listenThread() {
			// to be run in another thread

			// [NSThread sleepForTimeInterval:4];
			// debug_log("ok thread 4 sec up");
			// dispatch_async(dispatch_get_main_queue(), ^{
			// 	// this is how i know it really ran on mainthread, because if you run this alert code from thread, it logs to console something like "it might break in future as you are running from thread"
			// 	// but with dispatch_async it does not log this, which means its on mainthread
			// 	NSAlert *alert = [[[NSAlert alloc] init] autorelease];
			// 	[alert setMessageText:@"Hi there."];
			// 	[alert runModal];
			// 	gCommScope["log"]("thread called to mainthread to write this!!!!", nullptr, nullptr);
			// });

			// Sleep(4000);
			// debug_log("doing postthread, mainwhnd", mainloopid);
			// std::string* rawr = new std::string("WOOHOO");
			// BOOL posted = PostMessage(mainloopid, WM_COMM, reinterpret_cast<WPARAM>(rawr), 0);
			// debug_log("posted:", posted);

			std::string payload_str;
			while (get_message(payload_str) || shouldStopListening) {
				if (shouldStopListening) {
					shouldStopListening = false;
					// break; // no need for this as its in an else loop
				} else {
					// PostMessage(mainloopid, WM_COMM, reinterpret_cast<WPARAM>(payload_ptr), 0);
					dispatch_async(dispatch_get_main_queue(), ^{
						// no need to make a payload_str_copy, because blocks capture by value, so it is ok if payload_str here changes while mainthread is using it (becaues its a copy)
							// https://developer.apple.com/library/content/documentation/Cocoa/Conceptual/ProgrammingWithObjectiveC/WorkingwithBlocks/WorkingwithBlocks.html -  08:09:06 	<arai>	it says it captures value so it will be cloned
						listenMain(payload_str);
					});
				}
			}
			// }
		});
	}
	void stop() {
		// stops listenThread
		shouldStopListening = true;
	}

	void listenMain(std::string payload_str) {
		// in main thread
		debug_log("Comm.server.webextexe - incoming, payload_str:", payload_str);
		auto payload = json::parse(payload_str);
		if (payload.count("method") == 1 && !payload["method"].is_null()) {
			// debug_log("yes it has method and it is not null, method:"); debug_log(payload["method"]);
			if (gCommScope.count(payload["method"]) == 1) {
				// debug_log("ok found method in gCommScope");
				ReportProgressFnPtr _aReportProgress = nullptr;
				ResolveFnPtr _aResolve = nullptr;
				if (payload["cbid"].is_number()) {
					// debug_log("ok there is a callback waiting, in background, so we setup _aReportProgress ");

					_aReportProgress = [&](json aProgressArg) {
						aProgressArg["__PROGRESS"] = 1; // NOTE: this is why `reportProgress` must always pass an object
														// this.THIS[messager_method](this.cbid, aProgressArg);
						copyMessage(payload["cbid"], aProgressArg, nullptr);
					};

					_aResolve = [&](json aFinalArg) {
						// aFinalArg MUST NOT include __PROGRESS
						debug_log("resolving with:", aFinalArg.dump());
						copyMessage(payload["cbid"], aFinalArg, nullptr);
					};
				}
				gCommScope[payload["method"]](payload["arg"], _aReportProgress, _aResolve);
			} else {
				debug_log("WARN: method is not in scope! method:", payload["method"]);
			}
		}
		else if (payload["cbid"].is_number()) {
			//debug_log("has cbid, cbid:"); debug_log(payload["cbid"]);
			int cbid = payload["cbid"];
			callbackReceptacle[cbid](payload["arg"]);
			if (payload["arg"].count("__PROGRESS") == 0) {
				callbackReceptacle.erase(cbid);
			}
		}
		else {
			//debug_log("Comm.server.webextexe - invalid combination");
			//debug_log("method:"); debug_log(payload["method"]);
			//debug_log("cbid:"); debug_log(payload["cbid"]);
		}
	}

	void callInBackground(json aMethod, json aArg, CommCallbackFnPtr aCallback) {
		copyMessage(aMethod, aArg, aCallback);
	}
private:
	bool shouldStopListening{ false };
	int nextcbid{ 1 };
	std::map<int, CommCallbackFnPtr> callbackReceptacle;
	std::thread *thd;

	void reportProgress(int aCbid, json aProgressArg) {
		aProgressArg["__PROGRESS"] = 1;
		// this.THIS[messager_method](this.cbid, aProgressArg);
		json method = aCbid;
		copyMessage(method, aProgressArg, nullptr);
	}

	void copyMessage(json aMethod, json aArg, CommCallbackFnPtr aCallback) {
		int cbid = 0;
		if (aMethod.is_number()) {
			//debug_log("copyMessage has NUMBER for method:"); debug_log(aMethod.dump());
			cbid = aMethod;
			aMethod = nullptr;
		}
		else {
			//debug_log("copyMessage has string for method:"); debug_log(aMethod.dump());
			if (aCallback) {
				//debug_log("copyMessage found it has a callback:"); debug_log(aCallback);
				cbid = nextcbid++;
				callbackReceptacle[cbid] = aCallback;
			}
			else {
				//debug_log("copyMessage found NO callback:"); debug_log(aCallback);
			}
		}

		json payload = {
			{ "method", aMethod },
			{ "arg", aArg },
			{ "cbid", cbid }
		};
		send_message(payload.dump());
	}

	bool read_u32(uint32_t* data) {
		return std::fread(reinterpret_cast<char*>(data), sizeof(uint32_t), 1, stdin) == 1;
	}

	bool read_string(std::string &str, uint32_t length) {
		str.resize(length);
		return std::fread(&str[0], sizeof(char), str.length(), stdin) == length;
	}

	bool write_u32(uint32_t data) {
		return std::fwrite(reinterpret_cast<char*>(&data), sizeof(uint32_t), 1, stdout) == 1;
	}

	bool write_string(const std::string &str) {
		return std::fwrite(&str[0], sizeof(char), str.length(), stdout) == str.length();
	}

	bool get_message(std::string& str) {
		uint32_t length;
		//debug_log("reading length");
		while (!read_u32(&length)) {
			// debug_log("failed to read length", "WILL RETRY");
		}
		//debug_log("reading string");
		while (!read_string(str, length)) {
			// debug_log("failed to read string", "WILL RETRY");
		}
		//debug_log("read string: [" + str + "]");
		//debug_log(str.length());
		return true;
	}

	bool send_message(const std::string& str) {
		//debug_log("writing length");
		while (!write_u32(str.length())) {
			// debug_log("failed to write length, for str:", str, "WILL RETRY");
		}
		//debug_log("writing string");
		while (!write_string(str)) {
			// debug_log("failed to write string, for str:", str, "WILL RETRY");
		}
		//debug_log("flushing");
		while (std::fflush(stdout) != 0) {
			// debug_log("failed to flush, for str:", str, "WILL RETRY");
		}
		return true;
	}
};
Comm comm;
// end - comm

////// start - comm funcs - things triggred by doing callInExe("THIS") from background
void testCallFromBgToExe(json aArg, ReportProgressFnPtr aReportProgress, ResolveFnPtr aResolve) {
	debug_log("in testCallFromBgToExe");
	debug_log("aArg:"); debug_log(aArg.dump());

	aReportProgress({
		{ "step", 12 }
	});

	json rez;
	aResolve(rez);
}

void log(json aArg, ReportProgressFnPtr aReportProgress, ResolveFnPtr aResolve) {
	debug_log("in log, aArg:", aArg.dump());
	if (aResolve) aResolve(nullptr);
}

void getExeVersion(json aArg, ReportProgressFnPtr aReportProgress, ResolveFnPtr aResolve) {
	aResolve(core["self"]["version"]);
}

////// end - comm funcs - things triggred by doing callInExe("THIS") from background

// platform functions
#import <sys/proc_info.h>
#import <libproc.h>
json getParentProcessInfo() {
	json info = {
		{ "pid", 0 },
		{ "path", 0 }
	};

	// get pid
	pid_t ppid = getppid();
	info["pid"] = ppid;

	// get path
	// http://stackoverflow.com/q/3018054/1828637
	int numberOfProcesses = proc_listpids(PROC_ALL_PIDS, 0, NULL, 0);
	pid_t pids[numberOfProcesses];
	bzero(pids, sizeof(pids));
	proc_listpids(PROC_ALL_PIDS, 0, pids, sizeof(pids));
	for (int i = 0; i < numberOfProcesses; ++i) {
	    if (pids[i] == 0) { continue; }
	    char pathBuffer[PROC_PIDPATHINFO_MAXSIZE];
	    bzero(pathBuffer, PROC_PIDPATHINFO_MAXSIZE);
	    proc_pidpath(pids[i], pathBuffer, sizeof(pathBuffer));
	    if (strlen(pathBuffer) > 0) {
			if (pids[i] == ppid) {
				info["path"] = pathBuffer;
				break;
			}
	        // debug_log(pids[i], "path:", pathBuffer);
	    }
	}

	return info;
}

json getAllResourcesByPID(int aPid) {
	// gets all resources by a PID, if pid is 0, it gives only resources of that pid

	// MessageBox(NULL, (LPCWSTR)L"Ok starting", (LPCWSTR)L"Listing Starting", MB_ICONWARNING | MB_CANCELTRYCONTINUE | MB_DEFBUTTON2);

	json list; // key is pid which holds an array of strings

	return list;
}

// addon functions
#include <stdio.h>
std::string getParentProfileDir() {
	// gets the OS.Constants.Path.profileDir for the parent firefox
	std::string rez = "";

	std::string outstr = "";
	// FILE *pipe = popen("lsof -p " + core["parent"]["pid"] + " | grep \"lock\"", "r");
	std::string pidstr = core["parent"]["pid"].dump();
	std::string cmd = "lsof -p " + pidstr;
	debug_log("cmd:", cmd);
	std::string outstr = unixCmd(cmd);
	if (outstr.length() > 0)
		if (outstr.find("/.parentlock") != std::string::npos) {
			std::string line = outstr.substr(outstr.find_last_of("\n", outstr.find("/.parentlock")));
			rez = line.substr(line.find("/"), line.find("/.parentlock") - line.find("/"));
		}
		// // parse it to json
		// json outjson = parseLsof(outstr);
		// debug_log("outjson:", outjson.dump());
		// for (int ix=0; ix<outjson.size(); ++ix) {
		// 	json entry = outjson[ix];
		// 	// debug_log(ix, entry.dump());
		// 	if (entry["NAME"].find("/.parentlock") != std::string::npos) {
		// 		rez = entry["NAME"].substr(0, entry["NAME"].find("/.parentlock"));
		// 		break;
		// 	}
		// }
	}

	return rez;
}

void init(void) {
	/* sets up core
		core = {
			self: {
				name
				version
				id
			},
			exe: {
				pid
			},
			parent: { // short for parent_exe
				pid,
				path
			},
			firefox: {
				profileDir
			}
		}
	*/
	core = {
		{ "self",
			{{ "name", "Profilist" },
			{ "id", "Profilist@jetpack" },
			{ "version", "5.0b" }}
		},
		{ "exe", {} },
		{ "parent", {} },
		{ "firefox", {} }
	};

	core["exe"]["pid"] = getpid();

	core["parent"] = getParentProcessInfo();

	core["firefox"] = {
		{ "profileDir", getParentProfileDir() }
	};


	debug_log("core.exe.pid: ", core["exe"]["pid"]);
	debug_log("core.parent: ", core["parent"].dump());
	debug_log("core.firefox.profileDir: ", core["firefox"]["profileDir"]);
}

// main

int main(void) {

	debug_log("ok in mac main MAC");

	comm.gCommScope["getExeVersion"] = getExeVersion;
	comm.gCommScope["testCallFromBgToExe"] = testCallFromBgToExe;
	comm.gCommScope["log"] = log;

	init();

	comm.callInBackground("testCallFromExeToBg", "inarg", [](json aArg) {
		 debug_log("in EXE testCallFromExeToBg_callback, aArg:", aArg.dump());
	});

	// start up comm before starting infinite main loop
	comm.start();

	[[NSApplication sharedApplication] run];

	return 0;
}
