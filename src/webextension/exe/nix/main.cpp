// standard defines for win app - https://msdn.microsoft.com/en-us/library/bb384843.aspx
#define WIN32
#define UNICODE
#define _UNICODE
#define _WINDOWS

// standard includes for win app - https://msdn.microsoft.com/en-us/library/bb384843.aspx
#include <windows.h>
#include <stdlib.h>
#include <string.h>
#include <tchar.h>

#include <winternl.h> // for getParentProcessInfo
#include <ntstatus.h> // for getParentProcessInfo
#include <psapi.h> // For access to GetModuleFileNameEx in getParentProcessInfo
// #include <RestartManager.h> // for getFirefoxProfileDir

// #include <memory> // for unique_ptr

// my personal headers
#include "json.hpp"
#include "my_ntexapi.h" // win only // for getAllResourcesByPID

// my namespaces
using json = nlohmann::json;

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
	fs.open("C:\\Users\\Mercurius\\Desktop\\log.txt", std::fstream::app);
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

// start - strcast
#include <vector>
#include <string>
#include <cstring>
#include <cwchar>
#include <cassert>

#include <windows.h>
#include <atlstr.h> // for CString

template<typename Td>
Td string_cast(const wchar_t* pSource, unsigned int codePage = CP_ACP);

template<typename Td>
Td cstring_cast(CString* pSource);

template<>
std::string string_cast(const wchar_t* pSource, unsigned int codePage)
{
	assert(pSource != 0);
	size_t sourceLength = std::wcslen(pSource);
	if (sourceLength > 0)
	{
		int length = ::WideCharToMultiByte(codePage, 0, pSource, sourceLength, NULL, 0, NULL, NULL);
		if (length == 0)
			return std::string();

		std::vector<char> buffer(length);
		::WideCharToMultiByte(codePage, 0, pSource, sourceLength, &buffer[0], length, NULL, NULL);

		return std::string(buffer.begin(), buffer.end());
	}
	else
		return std::string();

}

template<>
std::string cstring_cast(CString* pSource)
{
	// http://stackoverflow.com/a/258052/1828637
	CT2CA pszConvertedAnsiString(*pSource);
	// construct a std::string using the LPCSTR input
	std::string str(pszConvertedAnsiString);
	return str;

}
////////
// string to wstring
// Then use .c_str() on the std::wstring to get a WCHAR* like.
// http://stackoverflow.com/a/18597384/1828637
#include <locale>
#include <codecvt>
std::wstring wstrOfStr(const std::string& narrow_utf8_source_string) {
    // for ( int i = 0 ; i < narrow_utf8_source_string.length(); i++) {
    //        debug_log(i, narrow_utf8_source_string[i], static_cast<int>(narrow_utf8_source_string[i]));
    // }
    std::wstring_convert<std::codecvt_utf8<wchar_t>> converter;
    // std::string utf8_aka_narrow = converter.to_bytes(wide_utf16_source_string);
    std::wstring utf16_aka_wide = converter.from_bytes(narrow_utf8_source_string);

	// debug_log("now utf16_aka_wide");
	// for (int i = 0; i < utf16_aka_wide.length(); i++) {
	// 	debug_log(i, utf16_aka_wide[i], static_cast<int>(utf16_aka_wide[i]));
	// }

    return utf16_aka_wide;
}
// http://stackoverflow.com/a/27296/1828637
std::wstring wstrOfStr2(const std::string& s) {
    int len;
    int slength = (int)s.length() + 1;
    len = MultiByteToWideChar(CP_ACP, 0, s.c_str(), slength, 0, 0);
    wchar_t* buf = new wchar_t[len];
    MultiByteToWideChar(CP_ACP, 0, s.c_str(), slength, buf, len);
    std::wstring r(buf);
    delete[] buf;
    return r;
}
// end - strcast

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

// http://stackoverflow.com/a/18792477/1828637
#include <atlstr.h> // for CString in GetDosPathFromNtPath
// common functions
// converts
// "\Device\HarddiskVolume3"                                -> "E:"
// "\Device\HarddiskVolume3\Temp"                           -> "E:\Temp"
// "\Device\HarddiskVolume3\Temp\transparent.jpeg"          -> "E:\Temp\transparent.jpeg"
// "\Device\Harddisk1\DP(1)0-0+6\foto.jpg"                  -> "I:\foto.jpg"
// "\Device\TrueCryptVolumeP\Data\Passwords.txt"            -> "P:\Data\Passwords.txt"
// "\Device\Floppy0\Autoexec.bat"                           -> "A:\Autoexec.bat"
// "\Device\CdRom1\VIDEO_TS\VTS_01_0.VOB"                   -> "H:\VIDEO_TS\VTS_01_0.VOB"
// "\Device\Serial1"                                        -> "COM1"
// "\Device\USBSER000"                                      -> "COM4"
// "\Device\Mup\ComputerName\C$\Boot.ini"                   -> "\\ComputerName\C$\Boot.ini"
// "\Device\LanmanRedirector\ComputerName\C$\Boot.ini"      -> "\\ComputerName\C$\Boot.ini"
// "\Device\LanmanRedirector\ComputerName\Shares\Dance.m3u" -> "\\ComputerName\Shares\Dance.m3u"
// returns an error for any other device type
DWORD GetDosPathFromNtPath(const WCHAR* u16_NTPath, CString* ps_DosPath)
{
	DWORD u32_Error;

	if (_wcsnicmp(u16_NTPath, L"\\Device\\Serial", 14) == 0 || // e.g. "Serial1"
		_wcsnicmp(u16_NTPath, L"\\Device\\UsbSer", 14) == 0)   // e.g. "USBSER000"
	{
		HKEY h_Key;
		if (u32_Error = RegOpenKeyEx(HKEY_LOCAL_MACHINE, L"Hardware\\DeviceMap\\SerialComm", 0, KEY_QUERY_VALUE, &h_Key))
			return u32_Error;

		WCHAR u16_ComPort[50];

		DWORD u32_Type;
		DWORD u32_Size = sizeof(u16_ComPort);
		if (u32_Error = RegQueryValueEx(h_Key, u16_NTPath, 0, &u32_Type, (BYTE*)u16_ComPort, &u32_Size))
		{
			RegCloseKey(h_Key);
			return ERROR_UNKNOWN_PORT;
		}

		*ps_DosPath = u16_ComPort;
		RegCloseKey(h_Key);
		return 0;
	}

	if (_wcsnicmp(u16_NTPath, L"\\Device\\LanmanRedirector\\", 25) == 0) // Win XP
	{
		*ps_DosPath = L"\\\\";
		*ps_DosPath += (u16_NTPath + 25);
		return 0;
	}

	if (_wcsnicmp(u16_NTPath, L"\\Device\\Mup\\", 12) == 0) // Win 7
	{
		*ps_DosPath = L"\\\\";
		*ps_DosPath += (u16_NTPath + 12);
		return 0;
	}

	WCHAR u16_Drives[300];
	if (!GetLogicalDriveStrings(300, u16_Drives))
		return GetLastError();

	WCHAR* u16_Drv = u16_Drives;
	while (u16_Drv[0])
	{
		WCHAR* u16_Next = u16_Drv + wcslen(u16_Drv) + 1;

		u16_Drv[2] = 0; // the backslash is not allowed for QueryDosDevice()

		WCHAR u16_NtVolume[1000];
		u16_NtVolume[0] = 0;

		// may return multiple strings!
		// returns very weird strings for network shares
		if (!QueryDosDevice(u16_Drv, u16_NtVolume, sizeof(u16_NtVolume) / 2))
			return GetLastError();

		int s32_Len = (int)wcslen(u16_NtVolume);
		if (s32_Len > 0 && _wcsnicmp(u16_NTPath, u16_NtVolume, s32_Len) == 0)
		{
			*ps_DosPath = u16_Drv;
			*ps_DosPath += (u16_NTPath + s32_Len);
			return 0;
		}

		u16_Drv = u16_Next;
	}
	return ERROR_BAD_PATHNAME;
}

// getMacAddress - http://stackoverflow.com/a/13688254/1828637
#include <stdio.h>
#include <Windows.h>
#include <Iphlpapi.h>
#include <Assert.h>
#pragma comment(lib, "iphlpapi.lib")

std::string getMacAddress() {
    std::string macaddr;

    ULONG pbuflen{0};
    GetAdaptersInfo(NULL, &pbuflen);

    debug_log("pbuflen:", pbuflen, "sizeof(IP_ADAPTER_INFO)", sizeof(IP_ADAPTER_INFO));

    // IP_ADAPTER_INFO* buf = (IP_ADAPTER_INFO*)malloc(pbuflen);
    IP_ADAPTER_INFO* buf = reinterpret_cast<IP_ADAPTER_INFO*>(new char[pbuflen]);

    DWORD rez = GetAdaptersInfo(buf, &pbuflen);
    debug_log("rez:", rez, "pbuflen x2:", pbuflen);

    if (rez != NO_ERROR) {
        debug_log("ERROR could not get adapters");
        return "ERROR";
    } else {
        IP_ADAPTER_INFO* cur = buf;
        while (cur) {
            char cmacaddr[512];
            sprintf_s(cmacaddr, sizeof(cmacaddr), "%.2x-%.2x-%.2x-%.2x-%.2x-%.2x",
                cur->Address[0],
                cur->Address[1],
                cur->Address[2],
                cur->Address[3],
                cur->Address[4],
                cur->Address[5]
            );
            bool isether = (cur->Type == MIB_IF_TYPE_ETHERNET);

            if (isether && macaddr.empty()) {
                macaddr = std::string(cmacaddr);
            }
            debug_log("cur init:", cur->AdapterName, cur->Description, "cur->AddressLength:", cur->AddressLength, "cmacaddr:", cmacaddr, "isether:", isether);
            cur = cur->Next;
        }
    }

    if (macaddr.empty()) {
        macaddr = "EMPTY";
    }
    delete [] buf;

    return macaddr;
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
//////
#include <shlobj.h>
std::string getPath(std::string name) {
    // name - desktop
    PWSTR path = NULL;

    // https://msdn.microsoft.com/en-us/library/windows/desktop/dd378457(v=vs.85).aspx
    std::map<std::string, GUID> namerefs {
        {"desktop", FOLDERID_Desktop},
        {"program_files", FOLDERID_ProgramFiles},
        {"user_app_data", FOLDERID_RoamingAppData},
    };

    if (namerefs.find(name) == namerefs.end()) {
        std::string known_names = "";

        for (std::map<std::string, GUID>::iterator it=namerefs.begin(); it!=namerefs.end(); ++it) {
            std::string a_known_name = it->first;
            known_names += a_known_name;
        }
        debug_log("getPath name unknown. name:", name, "supported names:", known_names);
        return "ERROR: name not known, supported names:" + known_names;
    }

    HRESULT hr = SHGetKnownFolderPath(namerefs[name], 0, NULL, &path);

    debug_log("path:", string_cast<std::string>(path));

    return string_cast<std::string>(path);
}
//////
bool launchPath(std::string path, std::string args="") {

    std::wstring pathw = wstrOfStr(path);
    std::wstring argsw = wstrOfStr(args);

    SHELLEXECUTEINFO sei;
    // memset((void*) &sei, 0, sizeof(sei));
    ZeroMemory(&sei, sizeof(sei));
    sei.cbSize = sizeof(sei);
    sei.lpFile = pathw.c_str();
    sei.lpVerb = L"open";
    sei.nShow = SW_SHOWNORMAL;
    if (!args.empty()) {
        sei.lpParameters = argsw.c_str();
    }

    BOOL didlaunch = ShellExecuteEx(&sei);
    if (didlaunch) {
        return true;
    } else {
        return false;
    }
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
///////
#pragma comment (lib, "Crypt32.lib")
#include <wincrypt.h>
#define CALC_HASH_BLOCK_SIZE 64
std::string calcHmac(PCSTR message, PCSTR key, std::string aStrType="base64", ALG_ID Algid=CALG_SHA1) {
    // aStrType - "base64" or "hex"
	std::string hash;

    UCHAR i_key_pad[CALC_HASH_BLOCK_SIZE], o_key_pad[CALC_HASH_BLOCK_SIZE];

    HCRYPTPROV  hProv;
    HCRYPTHASH  hHash;
    ULONG len = (ULONG)strlen(key), cb;
    BOOL f;

    if (f = CryptAcquireContext(&hProv, NULL, MS_DEF_PROV, PROV_RSA_FULL, CRYPT_VERIFYCONTEXT))
    {
        if (len > CALC_HASH_BLOCK_SIZE)
        {
            if (f = CryptCreateHash(hProv, Algid, 0, 0, &hHash))
            {
                f = CryptHashData(hHash, (PBYTE)key, len, 0) &&
                    CryptGetHashParam(hHash, HP_HASHSIZE, (BYTE*)&len, &(cb = sizeof(len)), 0) &&
                    CryptGetHashParam(hHash, HP_HASHVAL, (BYTE*)(key = (PCSTR)alloca(len)), &len, 0);

                CryptDestroyHash(hHash);
            }
        }

        if (f)
        {
            ULONG i = CALC_HASH_BLOCK_SIZE;

            do
            {
                UCHAR c = --i < len ? key[i] : 0;

                i_key_pad[i] = 0x36 ^ c;
                o_key_pad[i] = 0x5c ^ c;

            } while (i);

            if (f = CryptCreateHash(hProv, Algid, 0, 0, &hHash))
            {
                f = CryptHashData(hHash, i_key_pad, sizeof(i_key_pad), 0) &&
                    CryptHashData(hHash, (PBYTE)message, (ULONG)strlen(message), 0) &&
                    CryptGetHashParam(hHash, HP_HASHSIZE, (BYTE*)&len, &(cb = sizeof(len)), 0) &&
                    CryptGetHashParam(hHash, HP_HASHVAL, (BYTE*)(key = (PCSTR)alloca(len)), &len, 0);

                CryptDestroyHash(hHash);

                if (f && (f = CryptCreateHash(hProv, Algid, 0, 0, &hHash)))
                {
                    f = CryptHashData(hHash, o_key_pad, sizeof(o_key_pad), 0) &&
                        CryptHashData(hHash, (PBYTE)key, len, 0) &&
                        CryptGetHashParam(hHash, HP_HASHVAL, (BYTE*)key, &len, 0);

                    DWORD base64Size = 0;
                    DWORD strflags = CRYPT_STRING_NOCRLF;
                    if (aStrType == "base64") {
                        strflags |= CRYPT_STRING_BASE64;
                    } else if (aStrType == "hex") {
                        strflags |= CRYPT_STRING_HEX;
                    }

                    if (!CryptBinaryToString((BYTE*)key, len, strflags, NULL, &base64Size)) {
                        debug_log("Error in CryptBinaryToString 1 0x%08x", GetLastError());
                        // goto ErrorExit;
                    } else {

                        WCHAR* base64 = new WCHAR[ base64Size + 1 ];
                        if (!CryptBinaryToString((BYTE*)key, len, strflags, base64, &base64Size)) {
                            debug_log("Error in CryptBinaryToString 2 0x%08x", GetLastError());
                            // goto ErrorExit;
                        } else {
                            hash = string_cast<std::string>(base64);
                            delete[] base64;
                            debug_log("hash:", hash);
                        }
                    }

                    CryptDestroyHash(hHash);

                    // if (f && len)
                    // {
                    //     debug_log("\nThe hash is:  ");
                    //     do {
                    //         debug_log("%02x", (UCHAR)*key++);
                    //     } while (--len);
					// 	debug_log("\n");
                    // }

                }
            }
        }

        CryptReleaseContext(hProv, 0);
    }

    return hash;
}
// end - cmn

// start - comm
#include <functional> // included in comm.h
#include <thread>

#define WM_COMM WM_USER + 101

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

	void start(HWND aMainEventLoopId) {
		// aMainEventLoopId - what to "post message" to, to get the main event loop to see this
		mainloopid = aMainEventLoopId;

		// send_message("\"CONNECT_CONFIRMATION\""); // crossfile-link994844

		// // debug as if native messaging did callInExe
		// std::thread *blah = new std::thread([&]() {
		// 	Sleep(4000);
		// 	debug_log("doing postthread, mainwhnd", mainloopid);
		// 	// json eee = { {"method","log"},{"arg", "rawwwwwr"}, {"cbid",2} };
		// 	json eee = { {"method","addHotkey"}, {"arg",{{"combo",{{"keyname","vk_A"},{"mods",json::array()}}},{"filename","a8a8a8a8"}}}, {"cbid",nullptr} };
		// 	std::string* rawr = new std::string(eee.dump());
		// 	BOOL posted = PostMessage(mainloopid, WM_COMM, reinterpret_cast<WPARAM>(rawr), 0);
		//
		// 	// Sleep(4000);
		// 	// json eee2 = { {"method","removeHotkey"}, {"arg",{{"filename","a8a8a8a8"}}}, {"cbid",nullptr} };
		// 	// std::string* rawr2 = new std::string(eee2.dump());
		// 	// BOOL posted2 = PostMessage(mainloopid, WM_COMM, reinterpret_cast<WPARAM>(rawr2), 0);
		// });

		// on construct, start the thread and start listening
		thd = new std::thread([&]() {
			// void listenThread() {
			// to be run in another thread

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
    					PostMessage(mainloopid, WM_COMM, reinterpret_cast<WPARAM>(payload_ptr), 0);
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
        json payload = json::parse(payload_str.c_str());
		debug_log("dur_parse:", (nowms() - st));

		if (payload.count("method") == 1 && !payload["method"].is_null()) {
			// debug_log("yes it has method and it is not null, method:", payload["method"]);
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
			}
			else {
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
	HWND mainloopid;

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
		// debug_log("read string: [" + str + "]");
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

// platform functions
int getExePid() {
    return GetCurrentProcessId();
}
json getParentProcessInfo() {
	json info = {
		{ "pid", 0 },
		{ "path", "" }
	};

	// get pid

	// https://github.com/luoyingwen/MyTesterC/blob/4c3e1356d7184b62f411ccc654921fc33c620c15/TestItmes/TestGetParentProcessId.cpp#L25
	HMODULE hdll = LoadLibraryA("NTDLL.DLL");
	if (hdll == NULL) {
		debug_log("hdll is NULL");
		return info;
	}

	NTSTATUS(WINAPI *NtQueryInformationProcess)(HANDLE ProcessHandle, PROCESSINFOCLASS ProcessInformationClass, PVOID ProcessInformation, ULONG ProcessInformationLength, PULONG ReturnLength);
	*(FARPROC *)&NtQueryInformationProcess = GetProcAddress(hdll, "NtQueryInformationProcess");

	if (NtQueryInformationProcess == NULL) {
		debug_log("NtQueryInformationProcess is NULL");
		FreeLibrary(hdll);
		return info;
	}

	PROCESS_BASIC_INFORMATION pbi; // struct is here - https://msdn.microsoft.com/en-us/library/windows/desktop/ms684280(v=vs.85).aspx
	ULONG ulSize = 0;
	NTSTATUS rez_qiproc = NtQueryInformationProcess(GetCurrentProcess(), ProcessBasicInformation, &pbi, sizeof(pbi), &ulSize);
	debug_log("rez_qiproc:"); debug_log(rez_qiproc);

	if (rez_qiproc == STATUS_SUCCESS) { // NTSTATUS codes from https://msdn.microsoft.com/en-us/library/cc704588.aspx
		// debug_log("ulSize:"); debug_log(ulSize);
		// debug_log("sizeof(pbi):"); debug_log(sizeof(pbi));
		info["pid"] = (ULONG_PTR)pbi.Reserved3; // Reserved3 is the parent process id - http://stackoverflow.com/a/3137081/1828637
	}

	FreeLibrary(hdll);

	// get path
	HANDLE hproc = NULL;
	TCHAR filename[MAX_PATH];
	hproc = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, FALSE, info["pid"]);
	if (hproc != NULL) {
		if (GetModuleFileNameEx(hproc, NULL, filename, MAX_PATH) != 0) {
            debug_log("filename:", string_cast<std::string>(filename));
			info["path"] = string_cast<std::string>(filename);
		}

		/*
		// special just for Trigger, for getFirefoxProfileDir
		FILETIME exittime, kerneltime, usertime;
		BOOL rez_gettime = GetProcessTimes(hproc, &parent_create_time, &exittime, &kerneltime, &usertime);
		debug_log("rez_gettime:"); debug_log(rez_gettime);
		*/

		// end special
		CloseHandle(hproc);
	}

	return info;
}

typedef std::map<ULONG_PTR, std::vector<std::string>> PidResourcesMap;

PidResourcesMap getAllResourcesByPID(int aPid) {
	// gets all resources by a PID, if pid is 0, it gives only resources of that pid

	// MessageBox(NULL, (LPCWSTR)L"Ok starting", (LPCWSTR)L"Listing Starting", MB_ICONWARNING | MB_CANCELTRYCONTINUE | MB_DEFBUTTON2);

    PidResourcesMap list;// key is pid which holds an array of strings

	HMODULE hdll = LoadLibraryA("NTDLL.DLL");
	if (hdll == NULL) {
		debug_log("hdll is NULL");
		return list;
	}

	NTSTATUS(WINAPI *NtQuerySystemInformation)(size_t SystemInformationClass, PVOID SystemInformation, ULONG SystemInformationLength, PULONG ReturnLength);
	*(FARPROC *)&NtQuerySystemInformation = GetProcAddress(hdll, "NtQuerySystemInformation");
	if (NtQuerySystemInformation == NULL) {
		debug_log("NtQuerySystemInformation is NULL");
		FreeLibrary(hdll);
		return list;
	}

	NTSTATUS(WINAPI *NtQueryInformationFile)(HANDLE FileHandle, PIO_STATUS_BLOCK IoStatusBlock, PVOID FileInformation, LONG Length, size_t FileInformationClass);
	*(FARPROC *)&NtQueryInformationFile = GetProcAddress(hdll, "NtQueryInformationFile");
	if (NtQueryInformationFile == NULL) {
		debug_log("NtQueryInformationFile is NULL");
		FreeLibrary(hdll);
		return list;
	}

	NTSTATUS(WINAPI *NtQueryObject)(HANDLE Handle, OBJECT_INFORMATION_CLASS_my ObjectInformationClass, PVOID ObjectInformation, ULONG ObjectInformationLength, PULONG ReturnLength);
	*(FARPROC *)&NtQueryObject = GetProcAddress(hdll, "NtQueryObject");
	if (NtQueryObject == NULL) {
		debug_log("NtQueryObject is NULL");
		FreeLibrary(hdll);
		return list;
	}

	// https://github.com/brave/chromium/blob/0876d0a852d80a5cc0ef6e3e7c252e2e9c5f8aa7/components/startup_metric_utils/browser/startup_metric_utils.cc#L463
	std::vector<BYTE> buf(32 * 1024);
	for (size_t tries = 0; tries < 3; ++tries) {
		ULONG return_length = 0;
		NTSTATUS rez_qiprocs = NtQuerySystemInformation(SystemExtendedHandleInformation, buf.data(), (ULONG)buf.size(), &return_length);
		debug_log("rez_qiprocs:"); debug_log(rez_qiprocs);

		if (rez_qiprocs == STATUS_BUFFER_TOO_SMALL) {
			debug_log("buf too small");
		}
		else if (rez_qiprocs == STATUS_INFO_LENGTH_MISMATCH) {
			debug_log("buf length mismatch");
		}

		debug_log("return_length:"), debug_log(return_length);
		debug_log("buf.size:"), debug_log(buf.size());

		// Insufficient space in the buffer.
		if (return_length > buf.size()) {
			buf.resize(return_length);
			continue;
		}

		if (NT_SUCCESS(rez_qiprocs) && return_length <= buf.size()) break;
	}

	SYSTEM_HANDLE_INFORMATION_EX* handles_info = reinterpret_cast<SYSTEM_HANDLE_INFORMATION_EX*>(buf.data());
	// SYSTEM_PROCESS_INFORMATION_EX* proc_info = reinterpret_cast<SYSTEM_PROCESS_INFORMATION_EX*>(buffer.data() + index);
	int handles_actual_cnt = handles_info->NumberOfHandles;
	debug_log("sizeof(SYSTEM_HANDLE_INFORMATION_EX):"); debug_log(sizeof(SYSTEM_HANDLE_INFORMATION_EX));
	debug_log("sizeof(handles_info->NumberOfHandles):"); debug_log(sizeof(handles_info->NumberOfHandles));
	debug_log("sizeof(handles_info->Reserved):"); debug_log(sizeof(handles_info->Reserved));
	debug_log("sizeof(SYSTEM_HANDLE_TABLE_ENTRY_INFO_EX):"); debug_log(sizeof(SYSTEM_HANDLE_TABLE_ENTRY_INFO_EX));
	int handles_avail_cnt = (buf.size() - sizeof(handles_info->NumberOfHandles) - sizeof(handles_info->Reserved)) / sizeof(SYSTEM_HANDLE_TABLE_ENTRY_INFO_EX);
	debug_log("handles_avail_cnt:"); debug_log(handles_avail_cnt);


	std::map<ULONG_PTR, std::vector<ULONG_PTR>> pid_hval_map;
	std::map<ULONG_PTR, std::vector<ULONG_PTR>>::iterator pid_hval_map_it;

	std::map<ULONG_PTR, std::vector<USHORT>> pid_hinfo_map;

	int debug_time = nowms();

	/*
	for (size_t ix_handle = 0; ix_handle < handles_avail_cnt; ++ix_handle) {

	}
	*/
	size_t byte_ix = sizeof(handles_info->NumberOfHandles) + sizeof(handles_info->Reserved); // index of byte in `buf`
	size_t handle_ix = -1;
	while (byte_ix < buf.size()) {
		SYSTEM_HANDLE_TABLE_ENTRY_INFO_EX* handle_entry = reinterpret_cast<SYSTEM_HANDLE_TABLE_ENTRY_INFO_EX*>(buf.data() + byte_ix);
		ULONG_PTR pid = handle_entry->UniqueProcessId;
		ULONG_PTR hval = handle_entry->HandleValue;

		byte_ix += sizeof(SYSTEM_HANDLE_TABLE_ENTRY_INFO_EX);
		handle_ix++;

		if (aPid != 0 && pid != aPid) continue;

		if (pid_hval_map.find(pid) == pid_hval_map.end()) {
			pid_hval_map[pid] = { hval };
			pid_hinfo_map[pid] = { handle_entry->ObjectTypeIndex };
		}
		else {
			pid_hval_map[pid].push_back(hval);
			pid_hinfo_map[pid].push_back(handle_entry->ObjectTypeIndex);
		}

		// debug_log("collecting pid:"); debug_log(pid);
		//if (pid != 0) {
		// pid_hval_map[pid] = hval;
		//}
		//else { debug_log("pid is 0 for hval"); debug_log(hval); }
	}

	debug_log(nowms() - debug_time); debug_log("time to collect all handles");

	debug_time = nowms();

	// get names
	HANDLE hcurproc = GetCurrentProcess();
	for (pid_hval_map_it = pid_hval_map.begin(); pid_hval_map_it != pid_hval_map.end(); ++pid_hval_map_it) {
		ULONG_PTR pid = pid_hval_map_it->first;
		std::vector<ULONG_PTR> hval_arr = pid_hval_map_it->second;

		// debug_log("naming pid:"); debug_log(pid);

		// debug_log("opening hproc for pid:"); debug_log(pid);
		HANDLE hproc = OpenProcess(PROCESS_DUP_HANDLE | PROCESS_QUERY_INFORMATION, false, pid);;
		if (hproc == NULL) {
			continue; // as it either just failed for opening hproc, or it failed previously
		}
		// else { debug_log("SUECCSFULLY OPENED PROC for pid:"); debug_log(pid); }

		size_t ix = -1;
		for (ULONG_PTR hval : hval_arr) {
			ix++;
			USHORT hinfo = pid_hinfo_map[pid][ix];
			// debug_log("ObjectTypeIndex:"); debug_log(hinfo);
			//if (hinfo != 34) continue;

			HANDLE h;

			BOOL rez_dup = DuplicateHandle(hproc, reinterpret_cast<HANDLE>(hval), hcurproc, &h, 0, false, DUPLICATE_SAME_ACCESS);
			if (rez_dup) {

				DWORD rez_filetype = GetFileType(h);
				// debug_log("rez_filetype:"); debug_log(rez_filetype);
				if (rez_filetype == FILE_TYPE_DISK) {

					// WCHAR Path[520];
					// DWORD rez_path = GetFinalPathNameByHandleW(h, Path, 520, VOLUME_NAME_DOS);
					// debug_log("rez_path:"); debug_log(rez_path);
					// if (rez_path) {
					// 	debug_log(string_cast<std::string>(Path));
					// }

					/*
					// https://github.com/cvsuser-chromium/chromium/blob/acb8e8e4a7157005f527905b48dd48ddaa3b863a/sandbox/win/sandbox_poc/pocdll/handles.cc#L115
					NTSTATUS status;
					FILE_NAME_INFORMATION *file_name = NULL;
					ULONG size_file = 0;
					IO_STATUS_BLOCK status_block = { 0 };
					do {
					// Delete the previous buffer create. The buffer was too small
					if (file_name) {
					delete[] reinterpret_cast<BYTE*>(file_name);
					file_name = NULL;
					}

					// Increase the buffer and do the call agan
					size_file += MAX_PATH;
					file_name = reinterpret_cast<FILE_NAME_INFORMATION *>(new BYTE[size_file]);
					// debug_log("doing NtQueryInformationFile with size_file:"); debug_log(size_file);
					status = NtQueryInformationFile(reinterpret_cast<HANDLE>(h), &status_block, file_name, size_file, FileNameInformation);
					// debug_log("got NtQueryInformationFile status:"); debug_log(status);
					} while (status == STATUS_BUFFER_OVERFLOW);

					if (status != STATUS_SUCCESS) {
					if (file_name) {
					delete[] file_name;
					file_name = NULL;
					}
					}

					if (file_name) {
					debug_log("yes has file_name, FileNameLength:"); debug_log(file_name->FileNameLength); debug_log("file_name->FileName:"); debug_log(string_cast<std::string>(file_name->FileName));
					delete[] file_name;
					file_name = NULL;
					}
					*/

					// https://github.com/cvsuser-chromium/chromium/blob/acb8e8e4a7157005f527905b48dd48ddaa3b863a/sandbox/win/sandbox_poc/pocdll/handles.cc#L72
					OBJECT_NAME_INFORMATION *name = NULL;
					ULONG name_size = 0;
					NTSTATUS rez_qob = NtQueryObject(h, ObjectNameInformation, name, name_size, &name_size);
					// debug_log("rez_qob:"); debug_log(rez_qob);
					if (name_size) {
						name = reinterpret_cast<OBJECT_NAME_INFORMATION *>(new BYTE[name_size]);

						// Query the name information a second time to get the name of the object referenced by the handle.
						NTSTATUS rez_qob2 = NtQueryObject(h, ObjectNameInformation, name, name_size, &name_size);
						// comment from http://stackoverflow.com/a/18792477/1828637
						// IMPORTANT: The return value from NtQueryObject is bullshit! (driver bug?)
						// - The function may return STATUS_NOT_SUPPORTED although it has successfully written to the buffer.
						// - The function returns STATUS_SUCCESS although h_File == 0xFFFFFFFF
						if (rez_qob2 == STATUS_SUCCESS) {
							// debug_log("name->ObjectName.Length:"); debug_log(name->ObjectName.Length);
							// debug_log("name->ObjectName.MaximumLength:"); debug_log(name->ObjectName.MaximumLength);
							if (name->ObjectName.Length) { // as if it is 0, the string_cast will fail
								std::string ntpath = string_cast<std::string>(name->ObjectName.Buffer);
								// debug_log("name->ObjectName.Buffer:"); debug_log(ntpath);

								CString dospath_cstring;
								GetDosPathFromNtPath(name->ObjectName.Buffer, &dospath_cstring);
								std::string dospath = cstring_cast<std::string>(&dospath_cstring);
								// debug_log(dospath);
                                if (list.find(pid) != list.end()) {
                                    list[pid].push_back(dospath);
                                } else {
                                    std::vector<std::string> pidlist;
                                    pidlist.push_back(dospath);
                                    list[pid] = pidlist;
                                }
							}
						} else {
							debug_log("rez_qob2 failed:"); debug_log(rez_qob2);
						}
					}
				}

				BOOL h_closed = CloseHandle(h);
				if (!h_closed) { debug_log("failed to close handle h, GetLastError:"); debug_log(GetLastError()); }
			}
			// else { debug_log("failed to duplicate handle, GetLastError:"); debug_log(GetLastError()); }
		}

		debug_log("ok closing hproc");
		// close hproc
		BOOL hproc_closed = CloseHandle(hproc);
		if (!hproc_closed) { debug_log("failed to close handle hproc, GetLastError:"); debug_log(GetLastError()); }
	}

	debug_log(nowms() - debug_time); debug_log("time to read all file paths");

	FreeLibrary(hdll);

	// MessageBox(NULL, (LPCWSTR)L"Ok done writing to file", (LPCWSTR)L"Listing Done", MB_ICONWARNING | MB_CANCELTRYCONTINUE | MB_DEFBUTTON2);

	return list;
}

std::string getFirefoxProfileDir() {
    // requires nub[NATIVETYPE]["parent"]["pid"]
    // returns "" on not found - should never happen
	// gets the OS.Constants.Path.profileDir for the parent firefox

	/*
	DWORD dwSession;
	WCHAR szSessionKey[CCH_RM_SESSION_KEY + 1] = { 0 };
	DWORD dwError = RmStartSession(&dwSession, 0, szSessionKey);
	if (dwError == ERROR_SUCCESS) {

	RM_UNIQUE_PROCESS pszApp = { nub["parent"]["pid"], parent_create_time };
	dwError = RmRegisterResources(dwSession, 0, NULL, 1, &pszApp, 0, NULL);
	if (dwError == ERROR_SUCCESS) {
	DWORD dwReason;
	UINT i;
	UINT nProcInfoNeeded;
	UINT nProcInfo = 10;
	RM_PROCESS_INFO rgpi[10];
	dwError = RmGetList(dwSession, &nProcInfoNeeded, &nProcInfo, rgpi, &dwReason);
	}
	else { debug_log("rmreg:"), debug_log(dwError); }
	}
	*/

	PidResourcesMap list = getAllResourcesByPID(nub[NATIVETYPE]["parent"]["pid"]);
    debug_log("list dump:");
    for (PidResourcesMap::iterator it=list.begin(); it!=list.end(); ++it) {
        ULONG_PTR pid = it->first;
        std::vector<std::string> resources = it->second;
        debug_log("   pid: ", pid, "\n     ", join(resources.begin(), resources.end(), "\n     "));
        std::string lock = "parent.lock";
        for (std::vector<std::string>::iterator it2=resources.begin(); it2!=resources.end(); ++it2) {
            std::string path = *it2;
            if (endsWith(path, lock)) {
                return path.substr(0, path.length() - lock.length() - 1); // extra - 1 to get rid of the trailing "\\"
            }
        }
    }

	return ""; // for not found
}

// addon specific gloabls
// FILETIME parent_create_time;

////// start - comm funcs - things triggred by doing callInExe("THIS") from background
void init(json aNub, ReportProgressFnPtr aReportProgress, ResolveFnPtr aResolve) {
    // if fail init process, then must call comm.stop and aResolve(std::string) where the string is the error reason

    // nub["self"] = aNub["self"]; // not required

    nub[NATIVETYPE]["pid"] = getExePid();
    nub[NATIVETYPE]["parent"] = getParentProcessInfo();

    std::string parent_path = nub[NATIVETYPE]["parent"]["path"];
    if (endsWith(parent_path, "firefox.exe")) {
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

    // get path to self exe
    TCHAR pathw[MAX_PATH];
    if(!GetModuleFileName(NULL, pathw, MAX_PATH)) {
        debug_log("applyExe: Failed to get path to self");
        if (aResolve) {
            aResolve("GET_PATH_FAILED");
        }
        return;
    }

    std::string path = string_cast<std::string>(pathw);
    debug_log("path:", path);

    // rename exe, as i cannot overwrite or delete as it is in use
    bool isrename_init = true;
    int isrename_retry = 0;
    while (isrename_init || isrename_retry == 1) {
        isrename_init = false;
        if (isrename_retry == 1) {
            isrename_retry = -1;
        }
        if (!StdFile::rename(path, path + ".todel")) {
            // probably failed due to it already exisiting
            if (isrename_retry == 0) {
                debug_log("has not yet retried rename, so lets try to delete the .todel and try again");
                if (StdFile::remove(path + ".todel")) {
                    // ok yesi t was removed, lets retry
                    debug_log("ok yes, the .todel version was there, i now removed it, lets retry renaming");
                    // debug_log("testing if it has been removed yet");
                    // while (StdFile::exists(path + ".todel")) {
                    //     debug_log("the .todel is still there even after removal, so not yet totally removed");
                    // }
                    // debug_log("ok yes its gone");
                    isrename_retry++;
                    continue;
                }
            }
            debug_log("applyExe: Failed to rename");
            if (aResolve) {
                aResolve("RENAME_FAILED");
            }
            return;
        }
    }

    std::string exeuint8 = aArg;
    // std::string path = getPath("user_app_data") + "\\Mozilla\\Firefox\\extension-exes\\trigger.exe";
	if (!StdFile::overwrite(path, exeuint8, true)) {
        debug_log("applyExe: Failed to write");
        if (aResolve) {
            aResolve("WRITE_FAILED");
        }
        return;
    }

    // get path to self
	// rename self
    // write

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
    std::string macaddr = getMacAddress();
    debug_log("macaddr:", macaddr);
    std::string mh = calcHmac(macaddr.c_str(), MH_SECRET.c_str(), "hex");
    replaceAll(mh, " ", "");
    aResolve(mh);

    // comm.callInBackground("calcHash", { {"msg",macaddr}, {"key",MH_SECRET} }, [&, aResolve](json aArg2) {
    //     debug_log("in getMh::calcHash, aArg2:", aArg2.dump());
    // });

    // comm.callInBackground("resetLabel", "window.getHashed = function(aArg) { var msg = aArg.msg; var key = aArg.key; return CryptoJS.HmacSHA1(msg, key).toString(); }", [&, aResolve, macaddr](json aArg2) {
    //     debug_log("in getMh::resetLabel, aArg2:", aArg2.dump());
    //     comm.callInBackground("getHashed", { {"msg","macaddr"}, {"key","macaddr"} }, [&, aResolve, macaddr](json aArg3) {
    //         debug_log("in getMh::resetLabel::getHashed, aArg3:", aArg3.dump());
    //         aResolve({ {"macaddr",macaddr}, {"mh",aArg3} });
    //     });
    // });
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
HHOOK hookListenKeys;

// std::map<std::string, int> gSerials; // used to calculate `max_enable_count` with `getMaxEnableCount`
int gNextHotkeyId{0};
std::map<int, json> gHotkeys;
bool gIsListeningKeys{false};
bool gIsRecordingKeys{false}; // while recording is true, no hotkeys are triggered
bool gShouldRecordingIgnoreMods{false};
std::map<DWORD, int> gDownKeys;

ResolveFnPtr gHotkeyRecordingResolve{nullptr};
ReportProgressFnPtr gHotkeyRecordingReport{nullptr};

std::map<DWORD, std::string> gModsAndName { // key is keycode, value is what options.html knows it by
	{VK_LSHIFT, "L_SHIFT"},
	{VK_RSHIFT, "R_SHIFT"},
	{VK_LCONTROL, "L_CONTROL"},
	{VK_RCONTROL, "R_CONTROL"},
	{VK_LWIN, "L_SUPER"},
	{VK_RWIN, "R_SUPER"},
	{VK_LMENU, "L_ALT"},
	{VK_RMENU, "R_ALT"}
	// {[VK_CAPITAL, "CAPSLOCK"}
};

void stopRecordingKeys(json, ReportProgressFnPtr, ResolveFnPtr);
std::string getKeynameFromKeycode(DWORD);
DWORD getKeycodeFromKeyname(std::string);

std::string gKeysRepeatDetectStr{""};
bool gHotkeyRecordingSoftStop; // set to true, when waiting for all keys to come up
DWORD gHotkeyTriggeredSoftStop{0}; // block all events until the keyname that went down, comes up
LRESULT CALLBACK callbackListenKeys(int ncode, WPARAM wparam, LPARAM lparam) {
	if (ncode < HC_ACTION) {
		return CallNextHookEx(NULL, ncode, wparam, lparam);
	} else if (ncode == HC_ACTION) {
		KBDLLHOOKSTRUCT khs = *((KBDLLHOOKSTRUCT *)lparam);

		const LRESULT BLOCK_KEY = 1;
		const WPARAM KEYUP = 0;
		const WPARAM KEYDN = 1;

		WPARAM keystate; // 1 == down, 0 == up
		switch (wparam) {
			case WM_KEYDOWN:
			case WM_SYSKEYDOWN:
					keystate = 1;
				break;
			case WM_KEYUP:
			case WM_SYSKEYUP:
					keystate = 0;
				break;
			default:
				debug_log("Got uknown wparam so cannot set keystate, wparam was:", wparam, "WM_KEYDOWN:", WM_KEYDOWN, "WM_SYSKEYDOWN:", WM_SYSKEYDOWN, "WM_KEYDOWN:", WM_KEYDOWN, "WM_SYSKEYDOWN:", WM_SYSKEYDOWN);
				return CallNextHookEx(NULL, ncode, wparam, lparam);
		}

		// debug_log("keystate:", keystate);

		DWORD keycode = khs.vkCode;
		// DWORD flags = khs.flags;
		// debug_log("keycode:", keycode);

		if (keystate == KEYDN) {
			gDownKeys[keycode] = 1; // just any number
		} else {
			// obviously KEYUP
			gDownKeys.erase(keycode);
		}

		// detect isrepeat
		bool isrepeat;
		std::string newdowns = "";
		for (std::map<DWORD, int>::iterator it=gDownKeys.begin(); it!=gDownKeys.end(); ++it) {
			DWORD a_downkeycode = it->first;
			newdowns = newdowns + ", " + getKeynameFromKeycode(a_downkeycode);
		}
		if (newdowns != gKeysRepeatDetectStr) {
			debug_log("newdowns:", newdowns);
			gKeysRepeatDetectStr = newdowns;
			isrepeat = false;
		} else {
			isrepeat = true;
		}

		if (gIsRecordingKeys) {
			if (isrepeat) {
				return BLOCK_KEY;
			}
			if (gHotkeyRecordingSoftStop) {
				if (gDownKeys.size() == 0) {
					stopRecordingKeys(nullptr, nullptr, nullptr);
				}
				return BLOCK_KEY;
			}
			if (keycode == VK_ESCAPE) {
				// on KEYDN just block it
				if (keystate == KEYUP) {
					// tell options.htm reocrding user_cancel
					gHotkeyRecordingResolve({ {"cancel","user_cancel"} });
					stopRecordingKeys(nullptr, nullptr, nullptr);
				}
				return BLOCK_KEY;
			} else {
				// key is not "Escape"
				if (gShouldRecordingIgnoreMods) {
					if (keystate == KEYDN) {
						json combo = { {"keyname",getKeynameFromKeycode(keycode)} };
						gHotkeyRecordingResolve(combo);
					} else {
						stopRecordingKeys(nullptr, nullptr, nullptr);
					}
				} else {
					// create combo from gDownKeys
					json combo = { {"mods", json::array()} };
					// debug_log("ok reading gDownKeys, size:", gDownKeys.size());
					for (std::map<DWORD, int>::iterator it=gDownKeys.begin(); it!=gDownKeys.end(); ++it) {
						DWORD a_keycode = it->first;
						// debug_log("a_keycode", a_keycode);
						// debug_log("a_keycode:", a_keycode, "getKeynameFromKeycode(a_keycode):", getKeynameFromKeycode(a_keycode));
						if (gModsAndName.count(a_keycode)) {
							std::string a_modnondirname = gModsAndName[a_keycode]; // CONTROL, SHIFT, SUPER, ALT, thats all i support for right now
							if (a_modnondirname[1] == '_') {
								a_modnondirname = a_modnondirname.substr(2);
							}
							combo["mods"].push_back(a_modnondirname);
						} else {
							combo["keyname"] = getKeynameFromKeycode(a_keycode);
						}
					}
					// debug_log("ok done");

					// debug_log("gDownKeys.size():", gDownKeys.size());
					// debug_log("combo:", combo.dump());

					if (!gModsAndName.count(keycode)) {
						if (keystate == KEYDN) {
							gHotkeyRecordingSoftStop = true;
							gHotkeyRecordingResolve({ {"recording",combo} });
						}
						// else { // moved to gHotkeyRecordingSoftStop
						// 	stopRecordingKeys(nullptr, nullptr, nullptr);
						// }
					} else {
						gHotkeyRecordingReport({ {"recording",combo} });
					}
				}
			}

			return BLOCK_KEY;
		} else {
			// see if any hotkey triggred
			if (gHotkeyTriggeredSoftStop != 0) {
				if (keycode == gHotkeyTriggeredSoftStop) {
					if (keystate == KEYUP) {
						debug_log("ok soft blocking and reseting");
						gHotkeyTriggeredSoftStop = 0; // ok done stoppage, start allowing it
					}
					return BLOCK_KEY;
				} else {
					return CallNextHookEx(NULL, ncode, wparam, lparam); // allow key, probably a modifier coming up
				}
			}
			if (keystate == KEYDN) {
				if (isrepeat) {
					return CallNextHookEx(NULL, ncode, wparam, lparam); // allow key // is a repeat from down
				}
				bool didtrigger = false; // if triggered any of the hotkeys, should only trigger one, but i dont have checks yet if duplicate hotkey combo's exist
				for (std::map<int, json>::iterator it=gHotkeys.begin(); it!=gHotkeys.end(); ++it) {
					json a_hotkey = it->second;
					int a_hotkeyid = it->first;
 					debug_log("gHotkeys it, a_hotkey:", a_hotkey.dump(), "a_hotkeyid:", a_hotkeyid);

					int totalkeys = 1 + a_hotkey["combo"]["mods"].size(); // 1 + for the "a_hotkey["keyname"]"
					debug_log("totalkeys:", totalkeys);

					if (gDownKeys.size() != totalkeys) {
						// same amount of keys not held
						continue; // go to next hotkey, continue it
					}

					// check if a_hotkey["keyname"] is in gDownKeys
					bool keymet = false;
					// for (std::map<DWORD, int>::iterator it2=gDownKeys.begin(); it2!=gDownKeys.end(); ++it2) {
					// 	DWORD a_downkeycode = it2->first;
					// 	std::string a_hotkeykeyname = a_hotkey["combo"]["keyname"];
					// 	DWORD a_hotkeykeycode = getKeycodeFromKeyname(a_hotkeykeyname);
					// 	debug_log("a_downkeycode", a_downkeycode, "a_hotkeykeyname:", a_hotkeykeyname, "a_hotkeykeycode:", a_hotkeykeycode);
					// 	if (a_downkeycode == getKeycodeFromKeyname(a_hotkeykeyname)) {
					// 		keymet = true;
					// 		break; // break it2 with intention to continue to next hotkey
					// 	}
					// }
					// the key must be the most recent key. like i dont want him to press the keyname then the mods and it gets accepted
					if (keycode == getKeycodeFromKeyname(a_hotkey["combo"]["keyname"])) {
						keymet = true;
					}
					debug_log("keymet:", keymet);
					if (!keymet) {
						continue; // go to next hotkey, continue it
					}

					// check if each a_hotkey["mods"] is met
					bool modsmet = true; // assume no mods
					for (json::iterator it3=a_hotkey["combo"]["mods"].begin(); it3!=a_hotkey["combo"]["mods"].end(); ++it3) {
						std::string a_modnondirname = *it3;
						debug_log("a_modnondirname:", a_modnondirname);

						bool thismodmet = false;

						// init to 0, as there is no VK_CODE 0, so i can use that to test if it exists
						DWORD a_l_modkeycode{0};
						bool check_l{false};
						DWORD a_r_modkeycode{0};
						bool check_r{false};
						DWORD a_nondir_modkeycode{0};
						bool check_nondir{false};

						// get nondir and dir keycodes for the mod
						for (std::map<DWORD, std::string>::iterator it4=gModsAndName.begin(); it4!=gModsAndName.end(); ++it4) {
							std::string a_moddirname = it4->second;
							DWORD a_modkeycode = it4->first;
							if (a_moddirname == "L_" + a_modnondirname) {
								a_l_modkeycode = a_modkeycode;
								check_l = true;
							} else if (a_moddirname == "R_" + a_modnondirname) {
								a_r_modkeycode = a_modkeycode;
								check_r = true;
							} else if (a_moddirname == a_modnondirname) {
								a_nondir_modkeycode = a_modkeycode;
								check_nondir = true;
							}
						}

						// check if its in gDownKeys
						for (std::map<DWORD, int>::iterator it5=gDownKeys.begin(); it5!=gDownKeys.end(); ++it5) {
							DWORD a_downkeycode = it5->first;
							if (check_l && a_downkeycode == a_l_modkeycode) {
								debug_log("left mod is actually down");
								thismodmet = true;
								break; // break it5, with intention to continue(well not really as nothing after this block) to check next mod
							}
							if (check_r && a_downkeycode == a_r_modkeycode) {
								thismodmet = true;
								debug_log("right mod is actually down");
								break; // break it5, with intention to continue(well not really as nothing after this block) to check next mod
							}
							if (check_nondir && a_downkeycode == a_nondir_modkeycode) {
								thismodmet = true;
								debug_log("nondir mod is actually down");
								break; // break it5, with intention to continue(well not really as nothing after this block) to check next mod
							}
						}

						if (!thismodmet) {
							modsmet = false;
							break; // break it3, as no more need to check more mods, as even just this mod wasnt met, intetion to continue to next hotkey
						}
					}

					if (!modsmet) {
						debug_log("mods not met");
						continue; // go to next hotkey, continue it
					}

					debug_log("mods met, triggering");
					// ok modsmet and keymet, trigger it
					gHotkeyTriggeredSoftStop = getKeycodeFromKeyname(a_hotkey["combo"]["keyname"]);
					comm.callInBackground("triggerCommand", a_hotkey["filename"], nullptr);
					didtrigger = true;
				}

				if (didtrigger) {
					return BLOCK_KEY;
				}
			}

			return CallNextHookEx(NULL, ncode, wparam, lparam); // allow key
		}
	}
}

void startListenKeys(json aArg, ReportProgressFnPtr aReportProgress, ResolveFnPtr aResolve) {
	// if its already started, do nothing
	if (gIsListeningKeys) {
		return;
	}

	hookListenKeys = SetWindowsHookEx(WH_KEYBOARD_LL, callbackListenKeys, NULL, 0);
	if (hookListenKeys == NULL) {
		if (aResolve) {
			aResolve({ { "cancel", GetLastError() } });
		}
	} else {
		gIsListeningKeys = true;
	}
}
void stopListenKeys(json aArg, ReportProgressFnPtr aReportProgress, ResolveFnPtr aResolve) {
	// if its already stopped, do nothing
	if (!gIsListeningKeys) {
		return;
	}

	BOOL unhooked = UnhookWindowsHookEx(hookListenKeys);
	if (!unhooked) {
		if (aResolve) {
			aResolve({ {"error", GetLastError()} });
		}
	} else {
		gIsListeningKeys = false;
		hookListenKeys = NULL;
		if (aResolve) {
			aResolve({ {"ok", true} });
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
std::map<std::string, DWORD> gKeynameKeycodes {
	{"LBUTTON", 0x01},
	{"RBUTTON", 0x02},
	{"CANCEL", 0x03},
	{"MBUTTON", 0x04},
	{"XBUTTON1", 0x05},
	{"XBUTTON2", 0x06},
	{"BACK", 0x08},
	{"TAB", 0x09},
	{"CLEAR", 0x0C},
	{"RETURN", 0x0D},
	{"SHIFT", 0x10},
	{"CONTROL", 0x11},
	{"MENU", 0x12},
	{"PAUSE", 0x13},
	{"CAPITAL", 0x14},
	{"KANA", 0x15},
	{"HANGEUL", 0x15},
	{"HANGUL", 0x15},
	{"JUNJA", 0x17},
	{"FINAL", 0x18},
	{"HANJA", 0x19},
	{"KANJI", 0x19},
	{"ESCAPE", 0x1B},
	{"CONVERT", 0x1C},
	{"NONCONVERT", 0x1D},
	{"ACCEPT", 0x1E},
	{"MODECHANGE", 0x1F},
	{"SPACE", 0x20},
	{"PRIOR", 0x21},
	{"NEXT", 0x22},
	{"END", 0x23},
	{"HOME", 0x24},
	{"LEFT", 0x25},
	{"UP", 0x26},
	{"RIGHT", 0x27},
	{"DOWN", 0x28},
	{"SELECT", 0x29},
	{"PRINT", 0x2A},
	{"EXECUTE", 0x2B},
	{"SNAPSHOT", 0x2C},
	{"INSERT", 0x2D},
	{"DELETE", 0x2E},
	{"HELP", 0x2F},
	{"LWIN", 0x5B},
	{"RWIN", 0x5C},
	{"APPS", 0x5D},
	{"SLEEP", 0x5F},
	{"NUMPAD0", 0x60},
	{"NUMPAD1", 0x61},
	{"NUMPAD2", 0x62},
	{"NUMPAD3", 0x63},
	{"NUMPAD4", 0x64},
	{"NUMPAD5", 0x65},
	{"NUMPAD6", 0x66},
	{"NUMPAD7", 0x67},
	{"NUMPAD8", 0x68},
	{"NUMPAD9", 0x69},
	{"MULTIPLY", 0x6A},
	{"ADD", 0x6B},
	{"SEPARATOR", 0x6C},
	{"SUBTRACT", 0x6D},
	{"DECIMAL", 0x6E},
	{"DIVIDE", 0x6F},
	{"F1", 0x70},
	{"F2", 0x71},
	{"F3", 0x72},
	{"F4", 0x73},
	{"F5", 0x74},
	{"F6", 0x75},
	{"F7", 0x76},
	{"F8", 0x77},
	{"F9", 0x78},
	{"F10", 0x79},
	{"F11", 0x7A},
	{"F12", 0x7B},
	{"F13", 0x7C},
	{"F14", 0x7D},
	{"F15", 0x7E},
	{"F16", 0x7F},
	{"F17", 0x80},
	{"F18", 0x81},
	{"F19", 0x82},
	{"F20", 0x83},
	{"F21", 0x84},
	{"F22", 0x85},
	{"F23", 0x86},
	{"F24", 0x87},
	{"NUMLOCK", 0x90},
	{"SCROLL", 0x91},
	{"OEM_NEC_EQUAL", 0x92},
	{"OEM_FJ_JISHO", 0x92},
	{"OEM_FJ_MASSHOU", 0x93},
	{"OEM_FJ_TOUROKU", 0x94},
	{"OEM_FJ_LOYA", 0x95},
	{"OEM_FJ_ROYA", 0x96},
	{"LSHIFT", 0xA0},
	{"RSHIFT", 0xA1},
	{"LCONTROL", 0xA2},
	{"RCONTROL", 0xA3},
	{"LMENU", 0xA4},
	{"RMENU", 0xA5},
	{"BROWSER_BACK", 0xA6},
	{"BROWSER_FORWARD", 0xA7},
	{"BROWSER_REFRESH", 0xA8},
	{"BROWSER_STOP", 0xA9},
	{"BROWSER_SEARCH", 0xAA},
	{"BROWSER_FAVORITES", 0xAB},
	{"BROWSER_HOME", 0xAC},
	{"VOLUME_MUTE", 0xAD},
	{"VOLUME_DOWN", 0xAE},
	{"VOLUME_UP", 0xAF},
	{"MEDIA_NEXT_TRACK", 0xB0},
	{"MEDIA_PREV_TRACK", 0xB1},
	{"MEDIA_STOP", 0xB2},
	{"MEDIA_PLAY_PAUSE", 0xB3},
	{"LAUNCH_MAIL", 0xB4},
	{"LAUNCH_MEDIA_SELECT", 0xB5},
	{"LAUNCH_APP1", 0xB6},
	{"LAUNCH_APP2", 0xB7},
	{"OEM_1", 0xBA},
	{"OEM_PLUS", 0xBB},
	{"OEM_COMMA", 0xBC},
	{"OEM_MINUS", 0xBD},
	{"OEM_PERIOD", 0xBE},
	{"OEM_2", 0xBF},
	{"OEM_3", 0xC0},
	{"OEM_4", 0xDB},
	{"OEM_5", 0xDC},
	{"OEM_6", 0xDD},
	{"OEM_7", 0xDE},
	{"OEM_8", 0xDF},
	{"OEM_AX", 0xE1},
	{"OEM_102", 0xE2},
	{"ICO_HELP", 0xE3},
	{"ICO_00", 0xE4},
	{"PROCESSKEY", 0xE5},
	{"ICO_CLEAR", 0xE6},
	{"PACKET", 0xE7},
	{"OEM_RESET", 0xE9},
	{"OEM_JUMP", 0xEA},
	{"OEM_PA1", 0xEB},
	{"OEM_PA2", 0xEC},
	{"OEM_PA3", 0xED},
	{"OEM_WSCTRL", 0xEE},
	{"OEM_CUSEL", 0xEF},
	{"OEM_ATTN", 0xF0},
	{"OEM_FINISH", 0xF1},
	{"OEM_COPY", 0xF2},
	{"OEM_AUTO", 0xF3},
	{"OEM_ENLW", 0xF4},
	{"OEM_BACKTAB", 0xF5},
	{"ATTN", 0xF6},
	{"CRSEL", 0xF7},
	{"EXSEL", 0xF8},
	{"EREOF", 0xF9},
	{"PLAY", 0xFA},
	{"ZOOM", 0xFB},
	{"NONAME", 0xFC},
	{"PA1", 0xFD},
	{"OEM_CLEAR", 0xFE},

	{"0", 0x30},
	{"1", 0x31},
	{"2", 0x32},
	{"3", 0x33},
	{"4", 0x34},
	{"5", 0x35},
	{"6", 0x36},
	{"7", 0x37},
	{"8", 0x38},
	{"9", 0x39},
	{"A", 0x41},
	{"B", 0x42},
	{"C", 0x43},
	{"D", 0x44},
	{"E", 0x45},
	{"F", 0x46},
	{"G", 0x47},
	{"H", 0x48},
	{"I", 0x49},
	{"J", 0x4A},
	{"K", 0x4B},
	{"L", 0x4C},
	{"M", 0x4D},
	{"N", 0x4E},
	{"O", 0x4F},
	{"P", 0x50},
	{"Q", 0x51},
	{"R", 0x52},
	{"S", 0x53},
	{"T", 0x54},
	{"U", 0x55},
	{"V", 0x56},
	{"W", 0x57},
	{"X", 0x58},
	{"Y", 0x59},
	{"Z", 0x5A}
};

std::string getKeynameFromKeycode(DWORD aKeycode) {
	// if cannot find keyname, then it just returns a string of aKeycode surrounded by '
	std::map<std::string, DWORD>::iterator it;
	for (it=gKeynameKeycodes.begin(); it!=gKeynameKeycodes.end(); ++it) {
		std::string a_keyname = it->first;
		DWORD a_keycode = it->second;
		if (a_keycode == aKeycode) {
			return a_keyname;
		}
	}

	std::ostringstream keycode_stream;
    keycode_stream << aKeycode;
    std::string keycode_string = keycode_stream.str();

	return "'" + keycode_string + "'";
}

DWORD getKeycodeFromKeyname(std::string aKeyname) {
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
	DWORD keycode = getKeycodeFromKeyname(keyname);

	// http://stackoverflow.com/a/2969148/1828637
	// http://stackoverflow.com/a/31307429/1828637

	std::vector<INPUT> inputs(2);

	ULONG_PTR dwExtraInfo = (ULONG_PTR)GetMessageExtraInfo();

	// press
	inputs[0].type = INPUT_KEYBOARD;
	inputs[0].ki.wVk = (WORD)keycode;
	inputs[0].ki.wScan = 0;
	inputs[0].ki.dwFlags = 0;
	inputs[0].ki.time = 0;
	inputs[0].ki.dwExtraInfo = dwExtraInfo;

	// release
	inputs[1].type = INPUT_KEYBOARD;
	inputs[1].ki.wVk = (WORD)keycode;
	inputs[1].ki.wScan = 0;
	inputs[1].ki.dwFlags = KEYEVENTF_KEYUP;
	inputs[1].ki.time = 0;
	inputs[1].ki.dwExtraInfo = dwExtraInfo;

	// press
	SendInput(inputs.size(), &inputs[0], sizeof(INPUT));

}

HWND forsystemmsg;
void sendSystemMessage(json aArg, ReportProgressFnPtr aReportProgress, ResolveFnPtr aResolve) {
	std::string lparamstr = aArg["lparam_str"];
	std::string msgstr = aArg["msg_str"];

	SendMessage((HWND)forsystemmsg, (UINT)parseInt(msgstr), (WPARAM)forsystemmsg, (LPARAM)(parseInt(lparamstr)));
}

////// end - comm funcs - things triggred by doing callInExe("THIS") from background

// main
LRESULT CALLBACK WndProc(HWND hwnd, UINT message, WPARAM wparam, LPARAM lparam) {

	debug_log("message:", message);
	switch (message) {
	case WM_COMM:
	{
		// std::unique_ptr<std::string> payload_ptr(reinterpret_cast<std::string*>(wparam));
		// std::string payload_str = *payload_ptr;

		std::string* payload_ptr = reinterpret_cast<std::string*>(wparam);
		std::string payload_str = *payload_ptr;
		delete payload_ptr;

		debug_log("got WM_COMM! payload_str:", "not showing");
		// debug_log("got WM_COMM! payload_str:", payload_str);
		comm.listenMain(payload_str);
	}
	break;
	default:
		return DefWindowProc(hwnd, message, wparam, lparam);
		break;
	}

	return 0;
}

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
	}
	else {
		LAST_CHAR_N += 1;
	}

	for (char& c : str) {
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
					}
					else {
						min = ix - word.length();
					}

					max = ix - 1;

					headers.push_back({
						{ "name", word },
						{ "min", min },
						{ "max", max }
					});
					word = "";
				}
			}
			else {
				word += c;
			}

			if (c == CHAR_N) {
				hdone = true;
				lnstix = ix + 1;
				headers[headers.size() - 1]["max"] = ix - 1;
			}
		}
		else {
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
				for (int a_hix = hix; a_hix<headers.size(); a_hix++) {
					// hix is definitely NEXT, because if word had length then it was incremented ELSE word was blank so no work field added to entry for this
					std::string cname = (headers[a_hix]["name"]);
					entry[cname] = "";
				}
				rez.push_back(entry);
				entry.clear();
				hix = 0;
				lnstix = ix + 1;
			}
			else {
				std::string::size_type cmin = static_cast<int>(headers[hix]["min"]);
				std::string::size_type cmax = static_cast<int>(headers[hix]["max"]);

				if (lnix >= cmin && lnix <= cmax) {
					word += c;
				}
				else if (lnix > cmax) {
					char end_char = (hix == headers.size() - 1) ? CHAR_N : CHAR_B;

					if (c != end_char) {
						word += c;
						headers[hix]["max"] = lnix;
					}
					else {
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
				}
				else if (lnix < cmin) {
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

int main(void) {

    // launchSystemFile({{"path", "firefox"}, {"args","-P -no-remote"}}, nullptr, nullptr);
    // bool didremove = StdFile::remove("C:\\Users\\Mercurius\\AppData\\Roaming\\Mozilla\\Firefox\\extension-exes\\trigger.exe.todel");
    // debug_log("didremove:", didremove);

    // std::string msgstr = "message";
    // std::string key = "key";
    // debug_log("hash:", calcHmac(msgstr.c_str(), key.c_str()));
    //
    // return 0;


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

    // functions for use in command code
	comm.gCommScope["getSystemPath"] = getSystemPath;
	comm.gCommScope["launchSystemFile"] = launchSystemFile;
	comm.gCommScope["sendSystemKey"] = sendSystemKey;
	comm.gCommScope["sendSystemMessage"] = sendSystemMessage; // win only?


	// init();

	// comm.callInBackground("testCallFromExeToBg", "inarg", [](json aArg) {
	// 	debug_log("in EXE testCallFromExeToBg_callback, aArg:", aArg.dump());
	// });

    // validateSerial("pJeXS4kXqARAk8eRJ47d3zbm4", nullptr, [](json aArg) {
    //     debug_log("validity:", aArg);
    // });

	WNDCLASSEX wcex;

	wcex.cbSize = sizeof(WNDCLASSEX);
	wcex.style = 0;
	wcex.lpfnWndProc = WndProc;
	wcex.cbClsExtra = 0;
	wcex.cbWndExtra = 0;
	wcex.hInstance = GetModuleHandle(NULL);
	wcex.hIcon = NULL;
	wcex.hCursor = NULL;
	wcex.hbrBackground = NULL;
	wcex.lpszMenuName = NULL;

	static TCHAR szWindowClass[] = _T("class-noit-ext-trigger");
	wcex.lpszClassName = szWindowClass;

	wcex.hIconSm = NULL;

	if (!RegisterClassEx(&wcex)) {
		MessageBox(NULL, _T("Trigger: Call to RegisterClassEx failed!"), _T("class-noit-ext-trigger"), NULL);
		return 1;
	}

	HWND mainhwnd = CreateWindow(szWindowClass, _T("window-noit-ext-trigger"), 0, 0, 0, 0, 0, HWND_MESSAGE, NULL, wcex.hInstance, NULL);
	if (!mainhwnd) {
		MessageBox(NULL, _T("Trigger: Call to CreateWindow failed!"), _T("window-noit-ext-trigger"), NULL);
		return 1;
	}
	forsystemmsg = mainhwnd;

	// start up comm before starting infinite main loop
	comm.start(mainhwnd);

	MSG msg;
	while (GetMessage(&msg, NULL, 0, 0)) {
		// TranslateMessage(&msg); // may not need this
		DispatchMessage(&msg);
	}
	// return (int)msg.wParam;

	return 0;
}
