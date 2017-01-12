#ifndef MY_NTEXTAPI_H
#define MY_NTEXTAPI_H

// too many conflicts when i tried to import ntextapi.h (which made me import ntkkapi.h) so I have to write my own header

// Copied from ntstatus.h because um/winnt.h conflicts with general inclusion of
// ntstatus.h.
#define STATUS_BUFFER_TOO_SMALL ((NTSTATUS)0xC0000023L)
#define STATUS_INFO_LENGTH_MISMATCH ((NTSTATUS)0xC0000004L)

// winternal.h defines SYSTEM_INFORMATION_CLASS, but not all members.
enum { SystemExtendedHandleInformation = 64 };

typedef struct _SYSTEM_HANDLE_TABLE_ENTRY_INFO_EX
{
	PVOID Object;
	ULONG_PTR UniqueProcessId;
	ULONG_PTR HandleValue;
	ULONG GrantedAccess;
	USHORT CreatorBackTraceIndex;
	USHORT ObjectTypeIndex;
	ULONG HandleAttributes;
	ULONG Reserved;
} SYSTEM_HANDLE_TABLE_ENTRY_INFO_EX, *PSYSTEM_HANDLE_TABLE_ENTRY_INFO_EX;

typedef struct _SYSTEM_HANDLE_INFORMATION_EX
{
	ULONG_PTR NumberOfHandles;
	ULONG_PTR Reserved;
	SYSTEM_HANDLE_TABLE_ENTRY_INFO_EX Handles[1];
} SYSTEM_HANDLE_INFORMATION_EX, *PSYSTEM_HANDLE_INFORMATION_EX;

// https://msdn.microsoft.com/en-us/library/windows/hardware/ff545817%28v=vs.85%29.aspx?f=255&MSPPError=-2147217396
typedef struct _FILE_NAME_INFORMATION {
	ULONG FileNameLength;
	WCHAR FileName[1];
} FILE_NAME_INFORMATION, *PFILE_NAME_INFORMATION;

// winternal.h defines FILE_INFORMATION_CLASS, but not all members.
enum { FileNameInformation = 9 };

typedef struct _OBJECT_NAME_INFORMATION {
	UNICODE_STRING          ObjectName;
} OBJECT_NAME_INFORMATION, *POBJECT_NAME_INFORMATION;

// _OBJECT_INFORMATION_CLASS  is already defined in winternal.h
typedef enum _OBJECT_INFORMATION_CLASS_my {
	ObjectNameInformation=1,
	ObjectAllInformation=3,
	ObjectDataInformation=4
} OBJECT_INFORMATION_CLASS_my, *POBJECT_INFORMATION_CLASS_my;

#endif