// g++ main.cc -o profilist -std=c++11 -lxcb -lpthread -lxcb-keysyms -lxcb-util -lX11 -lcrypto
// on ubuntu first do `sudo apt-get install libxcb-util-dev`
// on ubuntu first do `sudo apt-get install libxcb-keysyms1-dev`
// `sudo apt-get install libx11-dev`
// `sudo apt-get install libssl-dev`
#define NIX64

#include <stdlib.h>
#include <stdio.h>
#include <inttypes.h>
#include <xcb/xcb.h>
#include <X11/keysym.h>
#include <xcb/xcb_keysyms.h>

#include <xcb/xcb_util.h>
#include <X11/Xlib.h>

#include <unistd.h> // usleep

// my personal headers
#include "json.hpp"

// my namespaces
using json = nlohmann::json;

// xcb globals
xcb_connection_t* connection;
int default_screen(0);
xcb_window_t rootwin;

// x11 globals
Display* display_x11;
Window rootwin_x11;

// globals
const std::string NATIVETYPE = "exe";
json nub = {
    { "nativetype", NATIVETYPE },
    { NATIVETYPE, {
        {"version", "1.0b"} // needed to be defined here and not in init as the startup process of background.js does a getExeVersion
    }}
};

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
  fs.open("/home/noi/Desktop/log.txt", std::fstream::app);
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

// start - stdfile
#include <stdio.h>
// needs forward decl for split
std::vector<std::string> split(const std::string &s, char delim);
namespace StdFile {
	bool exists(const std::string fileName)
	{
		std::fstream file;
		file.open(fileName.c_str(), std::ios::in);
		if (file.is_open() == true)
		{
			file.close();
			return true;
		}
		file.close();
		return false;
	}

	bool copy(const std::string fileNameFrom, const std::string fileNameTo)
	{
		// assert(exists(fileNameFrom));
		std::ifstream in(fileNameFrom.c_str());
		std::ofstream out(fileNameTo.c_str());
		out << in.rdbuf();
		out.close();
		in.close();

		return true;
	}

	bool rename(const std::string aOldPath, const std::string aNewPath) {
		// path should be same, only name should be different. as move may not happen it may be platform dependent
		// aNewPath should not exist as its platform dependent
		int result = std::rename(aOldPath.c_str(), aNewPath.c_str());
		if (result == 0) {
            debug_log("Succesfully renamed!");
			return true;
		} else {
			debug_log("rename failed with result:", result, "path:", aOldPath, "new path:", aNewPath);
			return false;
		}
	}

	bool append(const std::string aPath, const std::string aContent) {
		std::fstream fs;
		fs.open(aPath, std::fstream::app);
		fs << aContent;
		fs.close();
		return true;
	}

	bool remove(const std::string aPath) {
		int result = std::remove(aPath.c_str());
		if (result != 0) {
            debug_log("Failed to remove file, result:", result, "path:", aPath);
			return false;
		} else {
			return true;
		}
	}

    bool overwrite(std::string path, std::string contents, bool isuint8str) {
        // if file is not there it is written
        if (isuint8str) {
            std::string uint8arrstr = contents;
            // debug_log("uint8arrstr:", uint8arrstr);

            std::vector<std::string> uint8strarr = split(uint8arrstr, ',');
            // debug_log("uint8strarr.size():", uint8strarr.size());

            std::vector<uint8_t> uint8vect;
            for(std::string& uint8str : uint8strarr) {
        		uint8vect.push_back(std::stoul(uint8str, nullptr, 10));
            }

            uint8_t* uint8arr = &uint8vect[0];
            std::ofstream fp;
            fp.open(path, std::ios::out | std::ios::binary );
            fp.write((char*)uint8arr, uint8vect.size());
        } else {
            std::fstream fs;
        	fs.open(path, std::fstream::out);
        	fs << contents;
        	fs.close();
        }

        return true;
    }
}
// end - stdfile

// start - cmn
bool endsWith(std::string const &haystack, std::string const &needle) {
    size_t ix = haystack.find(needle);
    if (ix == std::string::npos) {
        return false;
    } else if (ix == haystack.length() - needle.length()) {
        return true;
    } else {
        return false;
    }
}
template <typename ParseStrArg>
std::string parseStr(ParseStrArg aInt) {
    // convert number to string
    std::ostringstream stream;
    stream << aInt;
    return stream.str();
}
int64_t parseInt(std::string str) {
	int64_t te;
	if (str.find("0x") != std::string::npos || str.find("0X") != std::string::npos) {
		te = std::stoul(str, nullptr, 16);
	}
	else {
		te = std::stoul(str, nullptr, 10);
	}
	debug_log("te int64_t:", te);
	return te;
}
int parseInt32(std::string str) {
	int te;
	te = std::stoul(str, nullptr, 10);
	return te;

	// int64_t te;
	// if (str.find("0x") != std::string::npos || str.find("0X") != std::string::npos) {
	// 	te = std::stoul(str, nullptr, 16);
	// }
	// else {
	// 	te = std::stoul(str, nullptr, 10);
	// }
}

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


// getMacAddress - http://stackoverflow.com/a/1779758/1828637
#include <sys/ioctl.h>
#include <net/if.h>
#include <unistd.h>
#include <netinet/in.h>
#include <string.h>
std::string getMacAddress() {

    struct ifreq ifr;
    struct ifconf ifc;
    char buf[1024];
    int success = 0;

    int sock = socket(AF_INET, SOCK_DGRAM, IPPROTO_IP);
    if (sock == -1) {
        debug_log("ERROR :: getMacAddress - failed 1");
        return "EMPTY";
    };

    ifc.ifc_len = sizeof(buf);
    ifc.ifc_buf = buf;
    if (ioctl(sock, SIOCGIFCONF, &ifc) == -1) {
        debug_log("ERROR :: getMacAddress - failed 2");
        return "EMPTY";
    }

    struct ifreq* it = ifc.ifc_req;
    const struct ifreq* const end = it + (ifc.ifc_len / sizeof(struct ifreq));

    for (; it != end; ++it) {
        strcpy(ifr.ifr_name, it->ifr_name);
        if (ioctl(sock, SIOCGIFFLAGS, &ifr) == 0) {
            if (! (ifr.ifr_flags & IFF_LOOPBACK)) { // don't count loopback
                if (ioctl(sock, SIOCGIFHWADDR, &ifr) == 0) {
                    success = 1;
                    break;
                }
            }
        } else {
            debug_log("ERROR :: getMacAddress - failed 3");
            return "EMPTY";
        }
    }

    // unsigned char mac_address[6];
    //
    // if (success) memcpy(mac_address, ifr.ifr_hwaddr.sa_data, 6);
    // else debug_log("ERROR :: getMacAddress - no success");

    // this printf technique and cast from here, it differs from the memcpy above - http://stackoverflow.com/a/24387019/1828637
    unsigned char *mac = NULL;
    mac = (unsigned char *)ifr.ifr_hwaddr.sa_data;
    // printf("Mac : %.2X:%.2X:%.2X:%.2X:%.2X:%.2X\n" , mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);

    char macaddrc[24];
    sprintf(&macaddrc[0], "%.2X:%.2X:%.2X:%.2X:%.2X:%.2X", mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);

    return std::string(macaddrc);
}


// replaceAll http://stackoverflow.com/a/29752943/1828637
void replaceAll( std::string& source, const std::string& from, const std::string& to )
{
    std::string newString;
    newString.reserve( source.length() );  // avoids a few memory allocations

    std::string::size_type lastPos = 0;
    std::string::size_type findPos;

    while( std::string::npos != ( findPos = source.find( from, lastPos )))
    {
        newString.append( source, lastPos, findPos - lastPos );
        newString += to;
        lastPos = findPos + from.length();
    }

    // Care for the rest after last occurrence
    newString += source.substr( lastPos );

    source.swap( newString );
}

std::string getPath(std::string name) {

}

bool launchPath(std::string path, std::string args="") {

}

// http://stackoverflow.com/a/236803/1828637
#include <string>
#include <sstream>
#include <vector>

void splitter(const std::string &s, char delim, std::vector<std::string> &elems) {
    std::stringstream ss;
    ss.str(s);
    std::string item;
    while (std::getline(ss, item, delim)) {
        elems.push_back(item);
    }
}

std::vector<std::string> split(const std::string &s, char delim) {
    std::vector<std::string> elems;
    splitter(s, delim, elems);
    return elems;
}

// http://stackoverflow.com/a/1430893/1828637
template <typename A>
std::string join(const A &begin, const A &end, const std::string &t) {
    std::string result;
    for (A it=begin; it!=end; it++) {
        if (!result.empty()) {
            result.append(t);
        }
        result.append(*it);
    }
    return result;
}

// atob btoa - http://stackoverflow.com/a/5291537/1828637
#include <string>
#include <cassert>
#include <limits>
#include <stdexcept>
#include <cctype>

static const char b64_table[65] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static const char reverse_table[128] = {
   64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64,
   64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64,
   64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 62, 64, 64, 64, 63,
   52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 64, 64, 64, 64, 64, 64,
   64,  0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14,
   15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 64, 64, 64, 64, 64,
   64, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
   41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 64, 64, 64, 64, 64
};

::std::string base64_encode(const ::std::string &bindata)
{
   using ::std::string;
   using ::std::numeric_limits;

   if (bindata.size() > (numeric_limits<string::size_type>::max() / 4u) * 3u) {
      throw ::std::length_error("Converting too large a string to base64.");
   }

   const ::std::size_t binlen = bindata.size();
   // Use = signs so the end is properly padded.
   string retval((((binlen + 2) / 3) * 4), '=');
   ::std::size_t outpos = 0;
   int bits_collected = 0;
   unsigned int accumulator = 0;
   const string::const_iterator binend = bindata.end();

   for (string::const_iterator i = bindata.begin(); i != binend; ++i) {
      accumulator = (accumulator << 8) | (*i & 0xffu);
      bits_collected += 8;
      while (bits_collected >= 6) {
         bits_collected -= 6;
         retval[outpos++] = b64_table[(accumulator >> bits_collected) & 0x3fu];
      }
   }
   if (bits_collected > 0) { // Any trailing bits that are missing.
      assert(bits_collected < 6);
      accumulator <<= 6 - bits_collected;
      retval[outpos++] = b64_table[accumulator & 0x3fu];
   }
   assert(outpos >= (retval.size() - 2));
   assert(outpos <= retval.size());
   return retval;
}

::std::string base64_decode(const ::std::string &ascdata)
{
   using ::std::string;
   string retval;
   const string::const_iterator last = ascdata.end();
   int bits_collected = 0;
   unsigned int accumulator = 0;

   for (string::const_iterator i = ascdata.begin(); i != last; ++i) {
      const int c = *i;
      if (::std::isspace(c) || c == '=') {
         // Skip whitespace and padding. Be liberal in what you accept.
         continue;
      }
      if ((c > 127) || (c < 0) || (reverse_table[c] > 63)) {
         throw ::std::invalid_argument("This contains characters not legal in a base64 encoded string.");
      }
      accumulator = (accumulator << 6) | reverse_table[c];
      bits_collected += 6;
      if (bits_collected >= 8) {
         bits_collected -= 8;
         retval += (char)((accumulator >> bits_collected) & 0xffu);
      }
   }
   return retval;
}

/////// calcHmacSha1
#include <openssl/evp.h>
#include <openssl/sha.h>
#include <openssl/hmac.h>

std::string calcHmac(std::string message, std::string key, std::string aStrType="base64", int Algid=0) {
    char hash[41];

    // The data that we’re going to hash using HMAC
    const unsigned char *unsignedData = (unsigned char *)message.c_str();
    unsigned char *digest;
    // I have used sha1 hash engine here.
    digest = HMAC(EVP_sha1(), key.c_str(), strlen(key.c_str()), unsignedData, strlen((char *)unsignedData), NULL, NULL);

    if (aStrType == "base64") {
        std::string bindata = std::string((char *)digest);
        std::string hash_b64 = base64_encode(bindata);
        return hash_b64;
    } else {
        // hex
        // Length of string depends on the chosen hash engine for example with the
        // chosen hash engine  i.e SHA1 it produces a 20-byte hash value which
        // rendered as 40 characters.
        // Length of the string need to be changed as per hash engine used.
        for (int i = 0; i < 20; i++) {
          sprintf(&hash[i * 2], "% 02x", (unsigned int)digest[i]);
        }

        std::string hash_hex = std::string(hash);

        return hash_hex;
    }
}

// unixCmd
std::string unixCmd(std::string cmd) {
	std::string outstr = "";
	// FILE *pipe = popen("lsof -p " + nub["parent"]["pid"] + " | grep \"lock\"", "r");

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

// platform common
// getXcbAtom
xcb_atom_t getXcbAtom(std::string name) {
	xcb_intern_atom_cookie_t req = xcb_intern_atom(connection, 1, name.length(), name.c_str());
	xcb_intern_atom_reply_t *rep = xcb_intern_atom_reply(connection, req, NULL);

	// if (rep.atom == XCB_ATOM_NONE) {
	//
	// }
	xcb_atom_t atom = rep->atom;

	free(rep);

	return atom;
}

// queryParents()
using QueryParentsCbFnPtr = std::function<bool(xcb_window_t, json&)>;
json queryParents(xcb_window_t aWin, QueryParentsCbFnPtr aCallback, bool aInclusive = false) {
	// aCallback - return true to break iteration. 2nd arg is json array which is returned by queryParents. it holds collection of results that happened during aCallback
	// aInclusive - true if you want to run aCallback on aWin

	json callback_results = json::array();
	// DFS - depth first search

	xcb_window_t win = aWin;
	if (aInclusive) {
		if (aCallback(win, callback_results)) {
			return callback_results;
		}
	}

	xcb_window_t root{0};

	while (true) {

		xcb_query_tree_cookie_t cookquery = xcb_query_tree(connection, win);
		xcb_query_tree_reply_t* repquery = xcb_query_tree_reply(connection, cookquery, NULL);

		if (root == 0) {
			root = repquery->root;
		}

		win = repquery->parent;
		free(repquery);

		if (aCallback(win, callback_results)) {
			return callback_results;
		}

		if (win == root) {
			return callback_results;
		}
	}

}

// getFocusedWindow
xcb_window_t getFocusedWindow() {
	xcb_get_input_focus_cookie_t cookfoc = xcb_get_input_focus(connection);
	xcb_get_input_focus_reply_t* repfoc = xcb_get_input_focus_reply(connection, cookfoc, NULL);

	xcb_window_t win = repfoc->focus;

	free(repfoc);

	return win;
}

// getWindowTitle
std::string getWindowTitle(xcb_window_t aWin) {
	xcb_get_property_cookie_t cookprop = xcb_get_property(connection, 0, aWin, XCB_ATOM_WM_NAME, XCB_ATOM_STRING, 0, 100); // `100` means it will get 100*4 so 400 bytes, so that 400 char, so `rez_title.bytes_after` should be `0` but i can loop till it comes out to be 0
	xcb_get_property_reply_t* repprop = xcb_get_property_reply(connection, cookprop, NULL);

	int len = xcb_get_property_value_length(repprop);
	char* buf = (char*)xcb_get_property_value(repprop);

	std::string title(buf);

	free(repprop);

	return title;
}

// getToppableWindow()
xcb_window_t getToppableWindow(xcb_window_t aWin) {
	xcb_window_t toppable;

	QueryParentsCbFnPtr qpcallback = [](xcb_window_t cWin, json &callback_results) {

		debug_log("doing cWin:", cWin);
		// callback_results.push_back(getWindowTitle(cWin));

		// test if it has _NET_WM_STATE atom
		xcb_get_property_cookie_t cookprop = xcb_get_property(connection, 0, cWin, getXcbAtom("_NET_WM_STATE"), XCB_GET_PROPERTY_TYPE_ANY, 0, 32);
		xcb_get_property_reply_t* repprop = xcb_get_property_reply(connection, cookprop, NULL);
		if (repprop) {
			xcb_atom_t proptype = repprop->type;
			free(repprop);
			if (proptype != XCB_NONE) { // if `repprop->type` is not XCB_NONE then it has the atom of `_NET_WM_STATE`
				// debug_log("cWin:", cWin, "has _NET_WM_STATE atom");
				callback_results.push_back(cWin);
				return true;
			} else {
				// debug_log("cWin:", cWin, "does NOT have _NET_WM_STATE atom");
				return false;
			}
		} else {
			return false;
		}
	};

	json qpcallback_results = queryParents(aWin, qpcallback, true);
	debug_log("qpcallback_results:", qpcallback_results.dump());

	if (qpcallback_results.size()) {
		toppable = qpcallback_results.at(0);
		debug_log("toppable window found, its title:", getWindowTitle(toppable));
	}

	return toppable;
}
// end - cmn

// start - strcast

// end - strcast

// start - comm
#include <functional> // included in comm.h
#include <thread>

// #define WM_COMM WM_USER + 101 // win
const uint32_t XCB_NOITCOMM_ATOM = 2951; // xcb

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

	void start(xcb_window_t aMainEventLoopId) {
		// aMainEventLoopId - what to "post message" to, to get the main event loop to see this

		mainloopid = aMainEventLoopId;

		// send_message("\"CONNECT_CONFIRMATION\""); // crossfile-link994844

		// on construct, start the thread and start listening
		thd = new std::thread([&]() {
			// void listenThread() {
			// to be run in another thread

			// sleep(4);
			// debug_log("ok thread 4 sec up");

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

            debug_log("starting listen");
			std::string payload_str;
            while (!shouldStopListening) {
    			while (get_message(payload_str)) {
    				if (shouldStopListening) {
    					shouldStopListening = false;
    					// break; // no need for this as its in an else loop
    				} else {
                        std::string* payload_ptr = new std::string(payload_str);

    					xcb_client_message_event_t event;
    				    event.response_type = XCB_CLIENT_MESSAGE;
    				    event.format = 32;
    				    event.type = XCB_NOITCOMM_ATOM;
    				    event.window = mainloopid;
    				    // event.data.data32[0] = 1;
    					memcpy(event.data.data32, &payload_ptr, sizeof(payload_ptr));

    					xcb_send_event(connection, 0, mainloopid, XCB_EVENT_MASK_PROPERTY_CHANGE, (const char *)&event);
    					xcb_flush(connection);
    				}
    			}
            }
            debug_log("COMM STOPPED");

			// }
		});
	}
	void stop() {
		// stops listenThread
		shouldStopListening = true;
	}

	void listenMain(std::string payload_str) {
		// in main thread
        debug_log("Comm.server.webextexe - incoming, payload_str:", "not showing");
        // debug_log("Comm.server.webextexe - incoming, payload_str:", payload_str);

        int st = nowms();
		json payload = json::parse(payload_str);
        debug_log("dur_parse:", (nowms() - st));

		if (payload.count("method") == 1 && !payload["method"].is_null()) {
			// debug_log("yes it has method and it is not null, method:"); debug_log(payload["method"]);
			if (gCommScope.count(payload["method"]) == 1) {
				// debug_log("ok found method in gCommScope");
				ReportProgressFnPtr _aReportProgress = nullptr;
				ResolveFnPtr _aResolve = nullptr;
				if (payload["cbid"].is_number()) {
					// debug_log("ok there is a callback waiting, in background, so we setup _aReportProgress ");

                    int cbid = payload["cbid"];

					_aReportProgress = [&, cbid](json aProgressArg) {
						aProgressArg["__PROGRESS"] = 1; // NOTE: this is why `reportProgress` must always pass an object
														// this.THIS[messager_method](this.cbid, aProgressArg);
						copyMessage(cbid, aProgressArg, nullptr);
					};

					_aResolve = [&, cbid](json aFinalArg) {
						// aFinalArg MUST NOT include __PROGRESS
                        debug_log("in aResolve");
						debug_log("resolving with:", aFinalArg.dump());
						copyMessage(cbid, aFinalArg, nullptr);
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
	xcb_window_t mainloopid;

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
        int st = nowms();
        std::string stringified = payload.dump();
		debug_log("dur_stringify:", (nowms() - st));
		send_message(stringified);
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
		while (true) {
            if(!read_u32(&length)) {
                debug_log("failed to read length", "SHOULD I RETRY?");
                return false; // comment this if you want retry
                continue; // uncomment this if you want retry
            }
            break;
		}
		//debug_log("reading string");
		while (true) {
            if (!read_string(str, length)) {
    			debug_log("failed to read string", "SHOULD I RETRY?");
                return false; // comment this if you want retry
                // continue; // uncomment this if you want retry
            }
            break;
		}
		debug_log("read string: [" + str + "]");
		//debug_log(str.length());
		return true;
	}

	bool send_message(const std::string& str) {
		//debug_log("writing length");
		while (!write_u32(str.length())) {
			debug_log("failed to write length, for str:", str, "WILL RETRY");
		}
		//debug_log("writing string");
		while (!write_string(str)) {
			debug_log("failed to write string, for str:", str, "WILL RETRY");
		}
		//debug_log("flushing");
		while (std::fflush(stdout) != 0) {
			debug_log("failed to flush, for str:", str, "WILL RETRY");
		}
		return true;
	}
};
Comm comm;
// end - comm
pid_t getExePid() {
    return getppid();
}
// platform functions
json getParentProcessInfo() {
	json info = {
		{ "pid", 0 },
		{ "path", "" }
	};

	// get pid
	pid_t ppid = getExePid();
	info["pid"] = ppid;

	// get path
	std::string pidstr = nub["parent"]["pid"].dump();
	info["path"] = unixCmd("readlink -f /proc/" + pidstr + "/exe");

	return info;
}

json getAllResourcesByPID(int aPid) {
	// gets all resources by a PID, if pid is 0, it gives only resources of that pid
	json list; // key is pid which holds an array of strings

	return list;
}

#include <stdio.h>
std::string getFirefoxProfileDir() {
	// gets the OS.Constants.Path.profileDir for the parent firefox
	std::string rez = "";

	std::string pidstr = nub["parent"]["pid"].dump();
	std::string cmd = "lsof -p " + pidstr;
	debug_log("cmd:", cmd);

	std::string outstr = unixCmd(cmd);
	// debug_log("outstr:", outstr.length(), outstr);
	if (outstr.length() > 0) {
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
		// 	std::string name = entry["NAME"];
		// 	if (name.find("/.parentlock") != std::string::npos) {
		// 		rez = name.substr(0, name.find("/.parentlock"));
		// 		break;
		// 	}
		// }

	}

	return rez;
}

////// start - comm funcs - things triggred by doing callInExe("THIS") from background
void init(json aNub, ReportProgressFnPtr aReportProgress, ResolveFnPtr aResolve) {
    // if fail init process, then must call comm.stop and aResolve(std::string) where the string is the error reason

    // nub["self"] = aNub["self"]; // not required

    nub[NATIVETYPE]["pid"] = getExePid();
    nub[NATIVETYPE]["parent"] = getParentProcessInfo();

    std::string parent_path = nub[NATIVETYPE]["parent"]["path"];
    if (parent_path.find("firefox.exe") != std::string::npos) {
        // getFirefoxProfileDir requires nub[NATIVETYPE]["parent"]["pid"]
        nub[NATIVETYPE]["parent"]["firefox_profiledir"] = getFirefoxProfileDir();
    } else {
        aResolve("NOT_FIREFOX");
        comm.stop();
        return;
    }

    // oauth config
    json oauth = {
        {"github", {
            {"client_id", "588171458d360bdb2497"},
            {"client_secret", "8d877cf13e5647f93ad42c28436e33e29aa8aa9b"},
            {"redirect_uri", "http://127.0.0.1/trigger_github"},
            {"scope", "user repo delete_repo"},
            {"dotname", "login"}, // `dotid` and `dotname` are dot paths in the `mem_oauth` entry. `dotid` is meant to point to something that uniquely identifies that account across all accounts on that oauth service's web server
            {"dotid", "id"}
        }}
    };

    aResolve({
        {"nativetype", NATIVETYPE},
        {NATIVETYPE, nub[NATIVETYPE]},
        // this is extra stuff i want to give it
        {"oauth", oauth} // oauth config
    });
}

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
	// debug_log("in log, aArg:", aArg.dump());
	// debug_log("in log, aArg:", "not showing");

    // get path to self
	// rename self
    // write

	if (aResolve) {
		aResolve(aArg);
	}
}

void getExeVersion(json aArg, ReportProgressFnPtr aReportProgress, ResolveFnPtr aResolve) {
	aResolve(nub[NATIVETYPE]["version"]);
}

void applyExe(json aArg, ReportProgressFnPtr aReportProgress, ResolveFnPtr aResolve) {
    // aArg is ArrayBuffer
	json rez;

    if (aResolve) {
        aResolve(nullptr);
    }
}

// addon Comm calls
const std::string MH_SECRET{"supar"};
void getSystemPath(json aArg, ReportProgressFnPtr aReportProgress, ResolveFnPtr aResolve) {
    if (aArg.count("name") == 0) {
        aResolve("ERROR: `name` not specifid");
        return;
    }
	std::string name = aArg["name"];
    std::string path = getPath(name);

    aResolve(path);
}

void launchSystemFile(json aArg, ReportProgressFnPtr aReportProgress, ResolveFnPtr aResolve) {
    if (aArg.count("path") == 0) {
        if (aResolve) {
            aResolve(false);
        }
        return;
    }

	std::string path = aArg["path"];

    if (!aArg.count("args")) {
        aArg["args"] = "";
    }
    std::string args = aArg["args"];

	bool didlaunch = launchPath(path, args);

    if (aResolve) {
        aResolve(didlaunch);
    }
}

void getMh(json aArg, ReportProgressFnPtr aReportProgress, ResolveFnPtr aResolve) {
    debug_log("in getMh, aArg:", aArg.dump());
    // std::string macaddr = getMacAddress();
    // debug_log("macaddr:", macaddr);
    // std::string mh = calcHmac(macaddr.c_str(), MH_SECRET.c_str(), "hex");
    // replaceAll(mh, " ", "");
    // aResolve(mh);
}

const int MIN_ENABLED_COUNT = 3;
std::map<std::string, int> gSerials; // used to calculate `max_enable_count` with `getMaxEnableCount`
int getMaxEnableCount() {
    int max_enable_count = MIN_ENABLED_COUNT;
    for (std::map<std::string, int>::iterator it=gSerials.begin(); it!=gSerials.end(); ++it) {
        int a_buyqty = it->second;
        max_enable_count += a_buyqty;
    }
    return max_enable_count;
}

void validateSerial(json aArg, ReportProgressFnPtr aReportProgress, ResolveFnPtr aResolve) {
    const int SALT_LEN = 8;

    if (!aArg.is_string()) {
        aResolve({{"isvalid", false}, {"reason", "NOT_STRING"}});
        return;
    }
    std::string serial = aArg;

    trim(serial);
    if (serial.length() < SALT_LEN + 1) {
        aResolve({{"isvalid", false}, {"reason", "BAD_LENGTH"}});
        return;
    }

    // test if serial already added
    if (gSerials.find(serial) != gSerials.end()) {
        aResolve({{"isvalid", false}, {"reason", "ALREADY_ADDED"}});
        return;
    }

    size_t salt_ix = serial.length() - SALT_LEN;
    std::string match_part = serial.substr(0, salt_ix);
    std::string salt = serial.substr(salt_ix);

    debug_log("serial:", serial, "match_part:", match_part, "salt:", salt);

    std::string macaddr = getMacAddress();
    std::string mh = calcHmac(macaddr.c_str(), MH_SECRET.c_str(), "hex");
    if (mh.empty()) {
        aResolve({ {"isvalid", false}, {"reason", "ERROR_MH"} });
        return;
    }
    replaceAll(mh, " ", "");

    // validateSerialRecurser(match_part, salt, mh, 0, aResolve);

    int isvalid = 0;

    const int MAX_BUYQTY = 12; // as paypal micropayments only works up til max of 12
    std::string a_saltmsg = "salt_" + salt;
    for (int buyqty=1; buyqty<=MAX_BUYQTY; buyqty++) {
        std::string a_key = parseStr(buyqty) + mh;
        std::string a_serial = calcHmac(a_saltmsg.c_str(), a_key.c_str());
        if (!a_serial.empty()) {
            debug_log("a_serial:", a_serial);

            replaceAll(a_serial, "=", "");
            replaceAll(a_serial, "+", "");
            replaceAll(a_serial, "/", "");

            std::string a_part = a_serial.substr(0, a_serial.length() - SALT_LEN);

            debug_log("a_serial repped:", a_serial, "a_part", a_part);
            if (a_part == match_part) {
                gSerials[match_part + salt] = buyqty;
                debug_log("added", match_part + salt, "to gSerials");

                isvalid = buyqty;
                break;
            }
        }
    }

    if (isvalid > 0) {
        aResolve({ {"isvalid", true}, {"buyqty", isvalid} });
    } else {
        aResolve({ {"isvalid", false}, {"reason", "BAD_COMPUTER"} });
    }
}

// key listening stuff below
void *hookListenKeys;

// std::map<std::string, int> gSerials; // used to calculate `max_enable_count` with `getMaxEnableCount`
int gNextHotkeyId{0};
std::map<int, json> gHotkeys;
bool gIsListeningKeys{false};
bool gIsRecordingKeys{false}; // while recording is true, no hotkeys are triggered
bool gShouldRecordingIgnoreMods{false};
std::map<xcb_keysym_t, int> gDownKeys;

ResolveFnPtr gHotkeyRecordingResolve{nullptr};
ReportProgressFnPtr gHotkeyRecordingReport{nullptr};

std::map<xcb_keysym_t, std::string> gModsAndName { // key is keycode, value is what options.html knows it by
	{XK_Shift_L, "L_SHIFT"},
	{XK_Shift_R, "R_SHIFT"},
	{XK_Control_L, "L_CONTROL"},
	{XK_Control_R, "R_CONTROL"},
	{XK_Super_L, "L_SUPER"},
	{XK_Super_R, "R_SUPER"},
	{XK_Alt_L, "L_ALT"},
	{XK_Alt_R, "R_ALT"}
	// {[VK_CAPITAL, "CAPSLOCK"}
};

void stopRecordingKeys(json, ReportProgressFnPtr, ResolveFnPtr);
std::string getKeynameFromKeycode(xcb_keysym_t);
xcb_keysym_t getKeycodeFromKeyname(std::string);

std::string gKeysRepeatDetectStr{""};
bool gHotkeyRecordingSoftStop; // set to true, when waiting for all keys to come up
xcb_keysym_t gHotkeyTriggeredSoftStop{0}; // is type of the key // block all events until the keyname that went down, comes up
void callbackListenKeys(uint8_t keystate, xcb_keysym_t keycode) {
    // only triggered if gIsListeningKeys == true
    // keycode is actually keysym
    const uint8_t KEYUP = 0;
    const uint8_t KEYDN = 1;


	if (keystate == KEYDN) {
		gDownKeys[keycode] = 1; // just any number
	} else {
		// obviously KEYUP
		gDownKeys.erase(keycode);
	}

    // detect isrepeat
    bool isrepeat;
    std::string newdowns = "";
    for (std::map<xcb_keysym_t, int>::iterator it=gDownKeys.begin(); it!=gDownKeys.end(); ++it) {
        xcb_keysym_t a_downkeycode = it->first;
        newdowns = newdowns + ", " + getKeynameFromKeycode(a_downkeycode);
    }
    if (newdowns != gKeysRepeatDetectStr) {
        debug_log("newdowns:", newdowns);
        gKeysRepeatDetectStr = newdowns;
        isrepeat = false;
    } else {
        isrepeat = true;
    }

    if (gKeysRecord_isRecording) {
        if (keycode == XK_Escape) {
        	debug_log("calling stopRecordingKeys");
        	stopRecordingKeys(nullptr, nullptr, nullptr);
        } else {
            // key is not "Escape"
            if (gShouldRecordingIgnoreMods) {
                // TODO
            } else {

            }
        }
    } else {

    }
}

void startListenKeys(json aArg, ReportProgressFnPtr aReportProgress, ResolveFnPtr aResolve) {
	// if its already started, do nothing
	if (gIsListeningKeys) {
		return;
	}

    xcb_grab_keyboard_cookie_t grabc = xcb_grab_keyboard(connection, 1, mm, XCB_CURRENT_TIME, XCB_GRAB_MODE_ASYNC, XCB_GRAB_MODE_ASYNC);
    xcb_grab_keyboard_reply_t* grabr = xcb_grab_keyboard_reply(connection, grabc, NULL);
    if (grabr) {
        if (grabr->status == XCB_GRAB_STATUS_SUCCESS) {
            debug_log("grabbed keyboard!");
            gIsListeningKeys = true;
        } else {
            debug_log("failed to grab keyboard, status:", (int)grabr->status); // need c style cast otherwise it debug_log's as a weird char
            aResolve({ { "cancel", "KEYBOARD_GRAB_STATUS_FAILED" } });
        }
        free(grabr);
    } else {
        debug_log("failed to grab keyboard grabr is NULL");
        if (aResolve) {
			// aResolve({ { "cancel", GetLastError() } });
            aResolve({ { "cancel", "KEYBOARD_GRAB_CALL_FAILED" } });
		}
    }
}
void stopListenKeys(json aArg, ReportProgressFnPtr aReportProgress, ResolveFnPtr aResolve) {
	// if its already stopped, do nothing
	if (!gIsListeningKeys) {
		return;
	}

    // for some reason, doing just `xcb_ungrab_keyboard(connection, XCB_CURRENT_TIME)` does not work
	xcb_void_cookie_t ungrabc = xcb_ungrab_keyboard_checked(connection, XCB_CURRENT_TIME);
	xcb_generic_error_t* ungrabe = xcb_request_check(connection, ungrabc);
	if (ungrabe == NULL || ungrabe->error_code == 0) {
		// success
		debug_log("succesfully ungrabbed");
        gIsListeningKeys = false;
		if (aResolve) {
			aResolve({ {"ok", true} });
		}
	} else {
		debug_log("Failed to ungrab keyboard, error_code:", ungrabe->error_code);
        if (aResolve) {
			// aResolve({ {"error", GetLastError()} });
            aResolve({ {"error", ungrabe->error_code} });
		}
	}
}
void ifstartListenKeys(json aArg, ReportProgressFnPtr aReportProgress, ResolveFnPtr aResolve) {
	// start listing keys if recording keys OR there are hotkeys to respond to
	if (gIsListeningKeys) {
		return; // was already listening
	}
	if (gIsRecordingKeys || gHotkeys.size() > 0) {
		startListenKeys(nullptr, nullptr, nullptr);
	}
}
void ifstopListenKeys(json aArg, ReportProgressFnPtr aReportProgress, ResolveFnPtr aResolve) {
	// stops listening keys if not recording keys, and no hotkeys to respond to
	if (!gIsListeningKeys) {
		return; // was not listening
	}
	if (!gIsRecordingKeys && gHotkeys.size() == 0) {
		stopListenKeys(nullptr, nullptr, nullptr);
	}
}
void startRecordingKeys(json aArg, ReportProgressFnPtr aReportProgress, ResolveFnPtr aResolve) {
	// aArg
		// ignoremods - bool

	bool ignoremods{false};
	if (aArg.count("ignoremods")) {
		ignoremods = aArg["ignoremods"];
	}
	gIsRecordingKeys = true;
	gShouldRecordingIgnoreMods = ignoremods;
	debug_log("gShouldRecordingIgnoreMods:", gShouldRecordingIgnoreMods);

	gHotkeyRecordingResolve = aResolve;
	gHotkeyRecordingReport = aReportProgress;

	gHotkeyRecordingSoftStop = false;

	startListenKeys(nullptr, nullptr, nullptr);
}
void stopRecordingKeys(json aArg, ReportProgressFnPtr aReportProgress, ResolveFnPtr aResolve) {
	gIsRecordingKeys = false;
	gShouldRecordingIgnoreMods = false;

	gHotkeyRecordingResolve = nullptr;
	gHotkeyRecordingReport = nullptr;

	gHotkeyRecordingSoftStop = false;

	ifstopListenKeys(nullptr, nullptr, nullptr);
}
void removeHotkey(json aArg, ReportProgressFnPtr aReportProgress, ResolveFnPtr aResolve) {
	// aArg
		// filename - string; filename of command that hotkey triggers

	debug_log("ok removing hotkey");

	bool removed = false;
	for (std::map<int, json>::iterator it=gHotkeys.begin(); it!=gHotkeys.end(); ++it) {
		json a_hotkey = it->second;
		int a_hotkeyid = it->first;
		// debug_log("a_hotkeyid:", a_hotkeyid, "a_hotkey:", a_hotkey.dump());
		if (a_hotkey["filename"] == aArg["filename"]) {
			gHotkeys.erase(it);
			removed = true;
			break;
		}
	}

	if (!removed) {
		debug_log("failed to find such a hotkey with such a filename");
	}

	ifstopListenKeys(nullptr, nullptr, nullptr);

}

void addHotkey(json aArg, ReportProgressFnPtr aReportProgress, ResolveFnPtr aResolve) {
	// aArg is object, keys - value
	// { combo:{keyname:"A", mods:[CONTROL/ALT/SUPER/SHIFT]}, filename:""}
		// filename is filename of command to trigger

	// check to see if this hotkey is already in there, and if it is then remove it
	std::string filename = aArg["filename"];
	debug_log("will send to removeHotkey now for filename:", filename);
	removeHotkey({{"filename",filename}}, nullptr, nullptr);

	// ok add it in
	debug_log("gHotkeys.size():", gHotkeys.size());
	json combo = aArg["combo"];
	if (gHotkeys.size() < getMaxEnableCount()) {
		int nextid = gNextHotkeyId++;
		debug_log("nextid:", nextid, "gNextHotkeyId:", gNextHotkeyId);
		gHotkeys[nextid] = {
			{ "combo", combo },
			{ "filename", filename }
		};
		debug_log("ok added hotkey, now size:", gHotkeys.size());
        if (aResolve) {
            aResolve({ {"didenable",true} });
        }
	} else {
        if (aResolve) {
            aResolve({ {"didenable",false},{"reason","MAX_ENABLED"},{"max_enable_count",getMaxEnableCount()} });
        }
    }

	ifstartListenKeys(nullptr, nullptr, nullptr); // if it didnt add, it will see that gHotkeys.size() is empty and so it wont start
}

std::map<std::string, xcb_keysym_t> gKeynameKeycodes {
    // key codes - https://github.com/semonalbertyeah/noVNC_custom/blob/60daa01208a7e25712d17f67282497626de5704d/include/keysym.js#L216
    {"XK_VoidSymbol", 0xffffff},

    {"XK_BackSpace", 0xff08},
    {"XK_Tab", 0xff09},
    {"XK_Linefeed", 0xff0a},
    {"XK_Clear", 0xff0b},
    {"XK_Return", 0xff0d},
    {"XK_Pause", 0xff13},
    {"XK_Scroll_Lock", 0xff14},
    {"XK_Sys_Req", 0xff15},
    {"XK_Escape", 0xff1b},
    {"XK_Delete", 0xffff},

    // Cursor control & motion

    {"XK_Home", 0xff50},
    {"XK_Left", 0xff51},
    {"XK_Up", 0xff52},
    {"XK_Right", 0xff53},
    {"XK_Down", 0xff54},
    {"XK_Prior", 0xff55},
    {"XK_Page_Up", 0xff55},
    {"XK_Next", 0xff56},
    {"XK_Page_Down", 0xff56},
    {"XK_End", 0xff57},
    {"XK_Begin", 0xff58},


    // Misc functions

    {"XK_Select", 0xff60},
    {"XK_Print", 0xff61},
    {"XK_Execute", 0xff62},
    {"XK_Insert", 0xff63},
    {"XK_Undo", 0xff65},
    {"XK_Redo", 0xff66},
    {"XK_Menu", 0xff67},
    {"XK_Find", 0xff68},
    {"XK_Cancel", 0xff69},
    {"XK_Help", 0xff6a},
    {"XK_Break", 0xff6b},
    {"XK_Mode_switch", 0xff7e},
    {"XK_script_switch", 0xff7e},
    {"XK_Num_Lock", 0xff7f},

    // Keypad functions, keypad numbers cleverly chosen to map to ASCII

    {"XK_KP_Space", 0xff80},
    {"XK_KP_Tab", 0xff89},
    {"XK_KP_Enter", 0xff8d},
    {"XK_KP_F1", 0xff91},
    {"XK_KP_F2", 0xff92},
    {"XK_KP_F3", 0xff93},
    {"XK_KP_F4", 0xff94},
    {"XK_KP_Home", 0xff95},
    {"XK_KP_Left", 0xff96},
    {"XK_KP_Up", 0xff97},
    {"XK_KP_Right", 0xff98},
    {"XK_KP_Down", 0xff99},
    {"XK_KP_Prior", 0xff9a},
    {"XK_KP_Page_Up", 0xff9a},
    {"XK_KP_Next", 0xff9b},
    {"XK_KP_Page_Down", 0xff9b},
    {"XK_KP_End", 0xff9c},
    {"XK_KP_Begin", 0xff9d},
    {"XK_KP_Insert", 0xff9e},
    {"XK_KP_Delete", 0xff9f},
    {"XK_KP_Equal", 0xffbd},
    {"XK_KP_Multiply", 0xffaa},
    {"XK_KP_Add", 0xffab},
    {"XK_KP_Separator", 0xffac},
    {"XK_KP_Subtract", 0xffad},
    {"XK_KP_Decimal", 0xffae},
    {"XK_KP_Divide", 0xffaf},

    {"XK_KP_0", 0xffb0},
    {"XK_KP_1", 0xffb1},
    {"XK_KP_2", 0xffb2},
    {"XK_KP_3", 0xffb3},
    {"XK_KP_4", 0xffb4},
    {"XK_KP_5", 0xffb5},
    {"XK_KP_6", 0xffb6},
    {"XK_KP_7", 0xffb7},
    {"XK_KP_8", 0xffb8},
    {"XK_KP_9", 0xffb9},

    // Auxiliary functions; note the duplicate definitions for left and right
    // function keys;  Sun keyboards and a few other manufacturers have such
    // function key groups on the left and/or right sides of the keyboard.
    // We've not found a keyboard with more than 35 function keys total.

    {"XK_F1", 0xffbe},
    {"XK_F2", 0xffbf},
    {"XK_F3", 0xffc0},
    {"XK_F4", 0xffc1},
    {"XK_F5", 0xffc2},
    {"XK_F6", 0xffc3},
    {"XK_F7", 0xffc4},
    {"XK_F8", 0xffc5},
    {"XK_F9", 0xffc6},
    {"XK_F10", 0xffc7},
    {"XK_F11", 0xffc8},
    {"XK_L1", 0xffc8},
    {"XK_F12", 0xffc9},
    {"XK_L2", 0xffc9},
    {"XK_F13", 0xffca},
    {"XK_L3", 0xffca},
    {"XK_F14", 0xffcb},
    {"XK_L4", 0xffcb},
    {"XK_F15", 0xffcc},
    {"XK_L5", 0xffcc},
    {"XK_F16", 0xffcd},
    {"XK_L6", 0xffcd},
    {"XK_F17", 0xffce},
    {"XK_L7", 0xffce},
    {"XK_F18", 0xffcf},
    {"XK_L8", 0xffcf},
    {"XK_F19", 0xffd0},
    {"XK_L9", 0xffd0},
    {"XK_F20", 0xffd1},
    {"XK_L10", 0xffd1},
    {"XK_F21", 0xffd2},
    {"XK_R1", 0xffd2},
    {"XK_F22", 0xffd3},
    {"XK_R2", 0xffd3},
    {"XK_F23", 0xffd4},
    {"XK_R3", 0xffd4},
    {"XK_F24", 0xffd5},
    {"XK_R4", 0xffd5},
    {"XK_F25", 0xffd6},
    {"XK_R5", 0xffd6},
    {"XK_F26", 0xffd7},
    {"XK_R6", 0xffd7},
    {"XK_F27", 0xffd8},
    {"XK_R7", 0xffd8},
    {"XK_F28", 0xffd9},
    {"XK_R8", 0xffd9},
    {"XK_F29", 0xffda},
    {"XK_R9", 0xffda},
    {"XK_F30", 0xffdb},
    {"XK_R10", 0xffdb},
    {"XK_F31", 0xffdc},
    {"XK_R11", 0xffdc},
    {"XK_F32", 0xffdd},
    {"XK_R12", 0xffdd},
    {"XK_F33", 0xffde},
    {"XK_R13", 0xffde},
    {"XK_F34", 0xffdf},
    {"XK_R14", 0xffdf},
    {"XK_F35", 0xffe0},
    {"XK_R15", 0xffe0},

    // Modifiers

    {"XK_Shift_L", 0xffe1},
    {"XK_Shift_R", 0xffe2},
    {"XK_Control_L", 0xffe3},
    {"XK_Control_R", 0xffe4},
    {"XK_Caps_Lock", 0xffe5},
    {"XK_Shift_Lock", 0xffe6},

    {"XK_Meta_L", 0xffe7},
    {"XK_Meta_R", 0xffe8},
    {"XK_Alt_L", 0xffe9},
    {"XK_Alt_R", 0xffea},
    {"XK_Super_L", 0xffeb},
    {"XK_Super_R", 0xffec},
    {"XK_Hyper_L", 0xffed},
    {"XK_Hyper_R", 0xffee},

    {"XK_ISO_Level3_Shift", 0xfe03},

    // Latin 1
    // (ISO/IEC 8859-1: Unicode U+0020..U+00FF)
    // Byte 3: 0

    {"XK_space", 0x0020},
    {"XK_exclam", 0x0021},
    {"XK_quotedbl", 0x0022},
    {"XK_numbersign", 0x0023},
    {"XK_dollar", 0x0024},
    {"XK_percent", 0x0025},
    {"XK_ampersand", 0x0026},
    {"XK_apostrophe", 0x0027},
    {"XK_quoteright", 0x0027},
    {"XK_parenleft", 0x0028},
    {"XK_parenright", 0x0029},
    {"XK_asterisk", 0x002a},
    {"XK_plus", 0x002b},
    {"XK_comma", 0x002c},
    {"XK_minus", 0x002d},
    {"XK_period", 0x002e},
    {"XK_slash", 0x002f},
    {"XK_0", 0x0030},
    {"XK_1", 0x0031},
    {"XK_2", 0x0032},
    {"XK_3", 0x0033},
    {"XK_4", 0x0034},
    {"XK_5", 0x0035},
    {"XK_6", 0x0036},
    {"XK_7", 0x0037},
    {"XK_8", 0x0038},
    {"XK_9", 0x0039},
    {"XK_colon", 0x003a},
    {"XK_semicolon", 0x003b},
    {"XK_less", 0x003c},
    {"XK_equal", 0x003d},
    {"XK_greater", 0x003e},
    {"XK_question", 0x003f},
    {"XK_at", 0x0040},
    {"XK_A", 0x0041},
    {"XK_B", 0x0042},
    {"XK_C", 0x0043},
    {"XK_D", 0x0044},
    {"XK_E", 0x0045},
    {"XK_F", 0x0046},
    {"XK_G", 0x0047},
    {"XK_H", 0x0048},
    {"XK_I", 0x0049},
    {"XK_J", 0x004a},
    {"XK_K", 0x004b},
    {"XK_L", 0x004c},
    {"XK_M", 0x004d},
    {"XK_N", 0x004e},
    {"XK_O", 0x004f},
    {"XK_P", 0x0050},
    {"XK_Q", 0x0051},
    {"XK_R", 0x0052},
    {"XK_S", 0x0053},
    {"XK_T", 0x0054},
    {"XK_U", 0x0055},
    {"XK_V", 0x0056},
    {"XK_W", 0x0057},
    {"XK_X", 0x0058},
    {"XK_Y", 0x0059},
    {"XK_Z", 0x005a},
    {"XK_bracketleft", 0x005b},
    {"XK_backslash", 0x005c},
    {"XK_bracketright", 0x005d},
    {"XK_asciicircum", 0x005e},
    {"XK_underscore", 0x005f},
    {"XK_grave", 0x0060},
    {"XK_quoteleft", 0x0060},
    {"XK_a", 0x0061},
    {"XK_b", 0x0062},
    {"XK_c", 0x0063},
    {"XK_d", 0x0064},
    {"XK_e", 0x0065},
    {"XK_f", 0x0066},
    {"XK_g", 0x0067},
    {"XK_h", 0x0068},
    {"XK_i", 0x0069},
    {"XK_j", 0x006a},
    {"XK_k", 0x006b},
    {"XK_l", 0x006c},
    {"XK_m", 0x006d},
    {"XK_n", 0x006e},
    {"XK_o", 0x006f},
    {"XK_p", 0x0070},
    {"XK_q", 0x0071},
    {"XK_r", 0x0072},
    {"XK_s", 0x0073},
    {"XK_t", 0x0074},
    {"XK_u", 0x0075},
    {"XK_v", 0x0076},
    {"XK_w", 0x0077},
    {"XK_x", 0x0078},
    {"XK_y", 0x0079},
    {"XK_z", 0x007a},
    {"XK_braceleft", 0x007b},
    {"XK_bar", 0x007c},
    {"XK_braceright", 0x007d},
    {"XK_asciitilde", 0x007e},

    {"XF86ModeLock", 0x1008FF01},
    {"XF86MonBrightnessUp", 0x1008FF02},
    {"XF86MonBrightnessDown", 0x1008FF03},
    {"XF86KbdLightOnOff", 0x1008FF04},
    {"XF86KbdBrightnessUp", 0x1008FF05},
    {"XF86KbdBrightnessDown", 0x1008FF06},
    {"XF86Standby", 0x1008FF10},
    {"XF86AudioLowerVolume", 0x1008FF11},
    {"XF86AudioMute", 0x1008FF12},
    {"XF86AudioRaiseVolume", 0x1008FF13},
    {"XF86AudioPlay", 0x1008FF14},
    {"XF86AudioStop", 0x1008FF15},
    {"XF86AudioPrev", 0x1008FF16},
    {"XF86AudioNext", 0x1008FF17},
    {"XF86HomePage", 0x1008FF18},
    {"XF86Mail", 0x1008FF19},
    {"XF86Start", 0x1008FF1A},
    {"XF86Search", 0x1008FF1B},
    {"XF86AudioRecord", 0x1008FF1C},
    {"XF86Calculator", 0x1008FF1D},
    {"XF86Memo", 0x1008FF1E},
    {"XF86ToDoList", 0x1008FF1F},
    {"XF86Calendar", 0x1008FF20},
    {"XF86PowerDown", 0x1008FF21},
    {"XF86ContrastAdjust", 0x1008FF22},
    {"XF86RockerUp", 0x1008FF23},
    {"XF86RockerDown", 0x1008FF24},
    {"XF86RockerEnter", 0x1008FF25},
    {"XF86Back", 0x1008FF26},
    {"XF86Forward", 0x1008FF27},
    {"XF86Stop", 0x1008FF28},
    {"XF86Refresh", 0x1008FF29},
    {"XF86PowerOff", 0x1008FF2A},
    {"XF86WakeUp", 0x1008FF2B},
    {"XF86Eject", 0x1008FF2C},
    {"XF86ScreenSaver", 0x1008FF2D},
    {"XF86WWW", 0x1008FF2E},
    {"XF86Sleep", 0x1008FF2F},
    {"XF86Favorites", 0x1008FF30},
    {"XF86AudioPause", 0x1008FF31},
    {"XF86AudioMedia", 0x1008FF32},
    {"XF86MyComputer", 0x1008FF33},
    {"XF86VendorHome", 0x1008FF34},
    {"XF86LightBulb", 0x1008FF35},
    {"XF86Shop", 0x1008FF36},
    {"XF86History", 0x1008FF37},
    {"XF86OpenURL", 0x1008FF38},
    {"XF86AddFavorite", 0x1008FF39},
    {"XF86HotLinks", 0x1008FF3A},
    {"XF86BrightnessAdjust", 0x1008FF3B},
    {"XF86Finance", 0x1008FF3C},
    {"XF86Community", 0x1008FF3D},
    {"XF86AudioRewind", 0x1008FF3E},
    {"XF86BackForward", 0x1008FF3F},
    {"XF86Launch0", 0x1008FF40},
    {"XF86Launch1", 0x1008FF41},
    {"XF86Launch2", 0x1008FF42},
    {"XF86Launch3", 0x1008FF43},
    {"XF86Launch4", 0x1008FF44},
    {"XF86Launch5", 0x1008FF45},
    {"XF86Launch6", 0x1008FF46},
    {"XF86Launch7", 0x1008FF47},
    {"XF86Launch8", 0x1008FF48},
    {"XF86Launch9", 0x1008FF49},
    {"XF86LaunchA", 0x1008FF4A},
    {"XF86LaunchB", 0x1008FF4B},
    {"XF86LaunchC", 0x1008FF4C},
    {"XF86LaunchD", 0x1008FF4D},
    {"XF86LaunchE", 0x1008FF4E},
    {"XF86LaunchF", 0x1008FF4F},
    {"XF86ApplicationLeft", 0x1008FF50},
    {"XF86ApplicationRight", 0x1008FF51},
    {"XF86Book", 0x1008FF52},
    {"XF86CD", 0x1008FF53},
    {"XF86Calculater", 0x1008FF54},
    {"XF86Clear", 0x1008FF55},
    {"XF86Close", 0x1008FF56},
    {"XF86Copy", 0x1008FF57},
    {"XF86Cut", 0x1008FF58},
    {"XF86Display", 0x1008FF59},
    {"XF86DOS", 0x1008FF5A},
    {"XF86Documents", 0x1008FF5B},
    {"XF86Excel", 0x1008FF5C},
    {"XF86Explorer", 0x1008FF5D},
    {"XF86Game", 0x1008FF5E},
    {"XF86Go", 0x1008FF5F},
    {"XF86iTouch", 0x1008FF60},
    {"XF86LogOff", 0x1008FF61},
    {"XF86Market", 0x1008FF62},
    {"XF86Meeting", 0x1008FF63},
    {"XF86MenuKB", 0x1008FF65},
    {"XF86MenuPB", 0x1008FF66},
    {"XF86MySites", 0x1008FF67},
    {"XF86New", 0x1008FF68},
    {"XF86News", 0x1008FF69},
    {"XF86OfficeHome", 0x1008FF6A},
    {"XF86Open", 0x1008FF6B},
    {"XF86Option", 0x1008FF6C},
    {"XF86Paste", 0x1008FF6D},
    {"XF86Phone", 0x1008FF6E},
    {"XF86Q", 0x1008FF70},
    {"XF86Reply", 0x1008FF72},
    {"XF86Reload", 0x1008FF73},
    {"XF86RotateWindows", 0x1008FF74},
    {"XF86RotationPB", 0x1008FF75},
    {"XF86RotationKB", 0x1008FF76},
    {"XF86Save", 0x1008FF77},
    {"XF86ScrollUp", 0x1008FF78},
    {"XF86ScrollDown", 0x1008FF79},
    {"XF86ScrollClick", 0x1008FF7A},
    {"XF86Send", 0x1008FF7B},
    {"XF86Spell", 0x1008FF7C},
    {"XF86SplitScreen", 0x1008FF7D},
    {"XF86Support", 0x1008FF7E},
    {"XF86TaskPane", 0x1008FF7F},
    {"XF86Terminal", 0x1008FF80},
    {"XF86Tools", 0x1008FF81},
    {"XF86Travel", 0x1008FF82},
    {"XF86UserPB", 0x1008FF84},
    {"XF86User1KB", 0x1008FF85},
    {"XF86User2KB", 0x1008FF86},
    {"XF86Video", 0x1008FF87},
    {"XF86WheelButton", 0x1008FF88},
    {"XF86Word", 0x1008FF89},
    {"XF86Xfer", 0x1008FF8A},
    {"XF86ZoomIn", 0x1008FF8B},
    {"XF86ZoomOut", 0x1008FF8C},
    {"XF86Away", 0x1008FF8D},
    {"XF86Messenger", 0x1008FF8E},
    {"XF86WebCam", 0x1008FF8F},
    {"XF86MailForward", 0x1008FF90},
    {"XF86Pictures", 0x1008FF91},
    {"XF86Music", 0x1008FF92},
    {"XF86Battery", 0x1008FF93},
    {"XF86Bluetooth", 0x1008FF94},
    {"XF86WLAN", 0x1008FF95},
    {"XF86UWB", 0x1008FF96},
    {"XF86AudioForward", 0x1008FF97},
    {"XF86AudioRepeat", 0x1008FF98},
    {"XF86AudioRandomPlay", 0x1008FF99},
    {"XF86Subtitle", 0x1008FF9A},
    {"XF86AudioCycleTrack", 0x1008FF9B},
    {"XF86CycleAngle", 0x1008FF9C},
    {"XF86FrameBack", 0x1008FF9D},
    {"XF86FrameForward", 0x1008FF9E},
    {"XF86Time", 0x1008FF9F},
    {"XF86Select", 0x1008FFA0},
    {"XF86View", 0x1008FFA1},
    {"XF86TopMenu", 0x1008FFA2},
    {"XF86Red", 0x1008FFA3},
    {"XF86Green", 0x1008FFA4},
    {"XF86Yellow", 0x1008FFA5},
    {"XF86Blue", 0x1008FFA6},
    {"XF86Suspend", 0x1008FFA7},
    {"XF86Hibernate", 0x1008FFA8},
    {"XF86TouchpadToggle", 0x1008FFA9},
    {"XF86TouchpadOn", 0x1008FFB0},
    {"XF86TouchpadOff", 0x1008FFB1},
    {"XF86AudioMicMute", 0x1008FFB2},
    {"XF86Switch_VT_1", 0x1008FE01},
    {"XF86Switch_VT_2", 0x1008FE02},
    {"XF86Switch_VT_3", 0x1008FE03},
    {"XF86Switch_VT_4", 0x1008FE04},
    {"XF86Switch_VT_5", 0x1008FE05},
    {"XF86Switch_VT_6", 0x1008FE06},
    {"XF86Switch_VT_7", 0x1008FE07},
    {"XF86Switch_VT_8", 0x1008FE08},
    {"XF86Switch_VT_9", 0x1008FE09},
    {"XF86Switch_VT_10", 0x1008FE0A},
    {"XF86Switch_VT_11", 0x1008FE0B},
    {"XF86Switch_VT_12", 0x1008FE0C},
    {"XF86Ungrab", 0x1008FE20},
    {"XF86ClearGrab", 0x1008FE21},
    {"XF86Next_VMode", 0x1008FE22},
    {"XF86Prev_VMode", 0x1008FE23},
    {"XF86LogWindowTree", 0x1008FE24},
    {"XF86LogGrabInfo", 0x1008FE25}
};

std::string getKeynameFromKeycode(xcb_keysym_t aKeycode) {
    // on linux this is actually getKeynameFromKeysym
	// if cannot find keyname, then it just returns a string of aKeycode surrounded by '
	std::map<std::string, xcb_keysym_t>::iterator it;
	for (it=gKeynameKeycodes.begin(); it!=gKeynameKeycodes.end(); ++it) {
		std::string a_keyname = it->first;
		xcb_keysym_t a_keycode = it->second;
		if (a_keycode == aKeycode) {
			return a_keyname;
		}
	}

    std::string keycode_string = parseStr(aKeycode);

	return "'" + keycode_string + "'";
}

xcb_keysym_t getKeycodeFromKeyname(std::string aKeyname) {
    // on linux this is actually getKeysymFromKeyname
	// if starts with ', then it is for a keyname that i dont have hard coded, so just return it as a number
	if (aKeyname[0] == '\'') {
		return parseInt32(aKeyname.substr(1, aKeyname.size() - 2));
	} else {
		if (gKeynameKeycodes.count(aKeyname)) {
			return gKeynameKeycodes[aKeyname];
		} else {
			debug_log("COULD NOT FIND keycode FOR aKeyname:", aKeyname);
			return 0;
		}
	}
}
//
void sendSystemKey(json aArg, ReportProgressFnPtr aReportProgress, ResolveFnPtr aResolve) {
	std::string keyname = aArg;
	xcb_keysym_t keycode = getKeycodeFromKeyname(keyname);

}

// HWND forsystemmsg;
void sendSystemMessage(json aArg, ReportProgressFnPtr aReportProgress, ResolveFnPtr aResolve) {
	std::string lparamstr = aArg["lparam_str"];
	std::string msgstr = aArg["msg_str"];

	// SendMessage((HWND)forsystemmsg, (UINT)parseInt(msgstr), (WPARAM)forsystemmsg, (LPARAM)(parseInt(lparamstr)));
}
////// end - comm funcs - things triggred by doing callInExe("THIS") from background

// main
int main(void) {

	debug_log("ok in mac main NIX");

    debug_log("macaddr:", getMacAddress());
    // debug_log("calcHmac:", calcHmac("message", "key"));
    // debug_log("calcHmac:", calcHmac("message", "key", "hex"));

    return 0;

    comm.gCommScope["getExeVersion"] = getExeVersion;
	comm.gCommScope["applyExe"] = applyExe;
	comm.gCommScope["testCallFromBgToExe"] = testCallFromBgToExe;
	comm.gCommScope["log"] = log;

    comm.gCommScope["init"] = init;
	comm.gCommScope["getMh"] = getMh;
	comm.gCommScope["validateSerial"] = validateSerial;

	comm.gCommScope["startListenKeys"] = startListenKeys;
	comm.gCommScope["stopListenKeys"] = stopListenKeys;
	comm.gCommScope["ifstartListenKeys"] = ifstartListenKeys;
	comm.gCommScope["ifstopListenKeys"] = ifstopListenKeys;
	comm.gCommScope["startRecordingKeys"] = startRecordingKeys;
	comm.gCommScope["stopRecordingKeys"] = stopRecordingKeys;
	comm.gCommScope["addHotkey"] = addHotkey;
	comm.gCommScope["removeHotkey"] = removeHotkey;

	debug_log("will now do init");
	// init();
	debug_log("init done");
	//
	// comm.callInBackground("testCallFromExeToBg", "inarg", [](json aArg) {
	// 	 debug_log("in EXE testCallFromExeToBg_callback, aArg:", aArg.dump());
	// });
	//

	// x11 init
	display_x11 = XOpenDisplay(NULL);
	rootwin_x11 = DefaultRootWindow(display_x11);

	// xcb init
	int rezconnect = xcb_connection_has_error(connection = xcb_connect(NULL, &default_screen));
	if (rezconnect) return rezconnect;

	xcb_screen_t *firstscreen;
	firstscreen = xcb_setup_roots_iterator(xcb_get_setup(connection)).data;

	rootwin = firstscreen->root;

	// // create InputOnly window
	xcb_window_t msgw = xcb_generate_id(connection);
	debug_log("ok msgw made");
    // const uint32_t values[] = { true };
	uint32_t mask = XCB_CW_OVERRIDE_REDIRECT | XCB_CW_EVENT_MASK;
	uint32_t values[] = { 1, XCB_EVENT_MASK_PROPERTY_CHANGE };
    xcb_create_window(connection, 0, msgw, rootwin, 0, 0, 10, 10, 0, XCB_WINDOW_CLASS_INPUT_ONLY, XCB_COPY_FROM_PARENT, mask, values);
	// uint32_t mask = XCB_CW_BACK_PIXEL | XCB_CW_OVERRIDE_REDIRECT | XCB_CW_EVENT_MASK;
	// uint32_t values[] = { firstscreen->black_pixel, 1, XCB_EVENT_MASK_PROPERTY_CHANGE };
	// xcb_create_window(connection, firstscreen->root_depth, msgw, firstscreen->root, 0, 0, 100, 100, 0, XCB_COPY_FROM_PARENT, firstscreen->root_visual, mask, values);
	debug_log("ok msgw win made");

	xcb_flush(connection); // it puts out a msg event of 28 initially

	// mask = XCB_EVENT_MASK_KEY_PRESS;
	// xcb_change_window_attributes(connection, rootwin, XCB_CW_EVENT_MASK, &mask);

	// std::string* payload_ptr0 = new std::string("rawr rawr rawr");
	//
	// xcb_client_message_event_t event;
	//
    // event.response_type = XCB_CLIENT_MESSAGE;
    // event.format = 32;
    // event.type = XCB_NOITCOMM_ATOM; // A__NET_WM_DESKTOP;
    // event.window = msgw;
    // // event.data.data32[0] = 1; //payload_ptr0;
	//
	// debug_log("sizeof(payload_ptr0):", sizeof(payload_ptr0));
	// memcpy(event.data.data32, &payload_ptr0, sizeof(payload_ptr0));
	//
	// std::thread *thd;
	// thd = new std::thread([&]() {
	// 	sleep(4);
	// 	debug_log("ok thread 4 sec up");
	// 	xcb_send_event(connection, 0, msgw, XCB_EVENT_MASK_PROPERTY_CHANGE, (const char *)&event);
	// 	debug_log("oksent");
	// 	xcb_convert_selection(connection, msgw, XCB_ATOM_PRIMARY, getXcbAtom("UTF8_STRING"), getXcbAtom("XSEL_DATA"), XCB_TIME_CURRENT_TIME);
	// 	xcb_flush(connection);
	// });

	// start up comm before starting infinite main loop
	comm.start(msgw);
	debug_log("did comm.start");

	// keysRecordStart(msgw, NULL, nullptr, nullptr);

	xcb_generic_event_t *e;
	while (e = xcb_wait_for_event(connection)) {
		switch (e->response_type & ~0x80) {
			case XCB_CLIENT_MESSAGE: {
				xcb_client_message_event_t *ce = (xcb_client_message_event_t *)e;
				debug_log("got XCB_CLIENT_MESSAGE!");

				debug_log("ce->type:", ce->type);
				switch (ce->type) {
					case XCB_NOITCOMM_ATOM: {
							debug_log("got XCB_NOITCOMM_ATOM!");
							std::string* payload_ptr;

							// debug_log("sizeof(ce.data.data32):", sizeof(ce.data.data32));
							memcpy(&payload_ptr, ce->data.data32, sizeof(ce->data.data32));

							std::string payload_str = *payload_ptr;
							delete payload_ptr;

							debug_log("got payload_str:", payload_str);
							comm.listenMain(payload_str);

						break;
					}
					default:
						debug_log("WARNING unknown XCB_CLIENT_MESSAGE type. ce->type:", ce->type);
				}

				break;
			}
			case XCB_SELECTION_NOTIFY: {
				debug_log("got XCB_SELECTION_NOTIFY!");
				break;
			}
			case XCB_KEY_PRESS: {
                if (gIsListeningKeys) {
    				xcb_key_press_event_t *ke = (xcb_key_press_event_t *)e;
    				xcb_keycode_t keycode(ke->detail);
                    xcb_keysym_t keysym(XKeycodeToKeysym(display_x11, keycode, 0)); // this is the `XK_*` const value
                    debug_log("Pressed keycode:", keycode, "keysym:", keysym);
                    callbackListenKeys(1, keysym);
                }
				break;
			}
			case XCB_KEY_RELEASE: {
                if (gIsListeningKeys) {
                    xcb_key_release_event_t *ke = (xcb_key_release_event_t *)e;
                    xcb_keycode_t keycode(ke->detail);
                    // i learned i have to take keycode to keysym from here - http://www.sbin.org/doc/Xlib/chapt_09.html
                    xcb_keysym_t keysym(XKeycodeToKeysym(display_x11, keycode, 0)); // this is the `XK_*` const value
                    debug_log("Released keycode:", keycode, "keysym:", keysym);
                    callbackListenKeys(0, keysym);
                }
				break;
			}
			default:
                // Unknown e type, ignore it
                debug_log("Unknown e: ", "XCB_EVENT_RESPONSE_TYPE:", XCB_EVENT_RESPONSE_TYPE(e), "~0x80:", (e->response_type & ~0x80), "plain:", e->response_type);
		}
		free(e);
	}

	// xcb uninit
	xcb_disconnect(connection);

	// x11 uninit
	XCloseDisplay(display_x11);

	return 0;
}
