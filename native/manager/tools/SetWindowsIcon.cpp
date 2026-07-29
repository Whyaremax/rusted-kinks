#define NOMINMAX
#include <windows.h>

#include <cstdint>
#include <cstring>
#include <fstream>
#include <iostream>
#include <limits>
#include <stdexcept>
#include <string>
#include <vector>

namespace {

#pragma pack(push, 1)
struct IconDirectory {
    std::uint16_t reserved;
    std::uint16_t type;
    std::uint16_t count;
};

struct IconEntry {
    std::uint8_t width;
    std::uint8_t height;
    std::uint8_t colorCount;
    std::uint8_t reserved;
    std::uint16_t planes;
    std::uint16_t bitCount;
    std::uint32_t bytesInResource;
    std::uint32_t imageOffset;
};

struct GroupIconEntry {
    std::uint8_t width;
    std::uint8_t height;
    std::uint8_t colorCount;
    std::uint8_t reserved;
    std::uint16_t planes;
    std::uint16_t bitCount;
    std::uint32_t bytesInResource;
    std::uint16_t resourceId;
};
#pragma pack(pop)

std::vector<std::uint8_t> readFile(const std::wstring& path)
{
    std::ifstream input(path, std::ios::binary | std::ios::ate);
    if (!input) {
        throw std::runtime_error("Could not open icon file");
    }
    const std::streamsize size = input.tellg();
    if (size <= 0
        || static_cast<std::uint64_t>(size)
            > std::numeric_limits<std::uint32_t>::max()) {
        throw std::runtime_error("Icon file has an unsafe size");
    }
    std::vector<std::uint8_t> bytes(static_cast<std::size_t>(size));
    input.seekg(0);
    if (!input.read(reinterpret_cast<char*>(bytes.data()), size)) {
        throw std::runtime_error("Could not read icon file");
    }
    return bytes;
}

template<typename T>
T readStruct(const std::vector<std::uint8_t>& bytes, std::size_t offset)
{
    if (offset > bytes.size() || sizeof(T) > bytes.size() - offset) {
        throw std::runtime_error("Truncated icon file");
    }
    T result{};
    std::memcpy(&result, bytes.data() + offset, sizeof(T));
    return result;
}

void writeStruct(std::vector<std::uint8_t>& bytes,
                 std::size_t offset,
                 const auto& value)
{
    if (offset > bytes.size() || sizeof(value) > bytes.size() - offset) {
        throw std::runtime_error("Internal icon resource overflow");
    }
    std::memcpy(bytes.data() + offset, &value, sizeof(value));
}

} // namespace

int wmain(int argc, wchar_t* argv[])
{
    if (argc != 3) {
        std::wcerr << L"Usage: KDHybridSetWindowsIcon <target.exe> <icon.ico>\n";
        return 2;
    }
    try {
        const std::vector<std::uint8_t> icon = readFile(argv[2]);
        const IconDirectory directory = readStruct<IconDirectory>(icon, 0);
        if (directory.reserved != 0 || directory.type != 1
            || directory.count == 0 || directory.count > 64) {
            throw std::runtime_error("Invalid ICO directory");
        }
        const std::size_t entriesBytes =
            static_cast<std::size_t>(directory.count) * sizeof(IconEntry);
        if (sizeof(IconDirectory) + entriesBytes > icon.size()) {
            throw std::runtime_error("Truncated ICO directory");
        }

        HANDLE update = BeginUpdateResourceW(argv[1], FALSE);
        if (update == nullptr) {
            throw std::runtime_error("BeginUpdateResourceW failed");
        }
        bool committed = false;
        try {
            std::vector<std::uint8_t> group(
                sizeof(IconDirectory)
                + static_cast<std::size_t>(directory.count)
                    * sizeof(GroupIconEntry));
            writeStruct(group, 0, directory);
            constexpr std::uint16_t firstIconId = 201;
            for (std::uint16_t index = 0; index < directory.count; ++index) {
                const IconEntry entry = readStruct<IconEntry>(
                    icon,
                    sizeof(IconDirectory)
                        + static_cast<std::size_t>(index) * sizeof(IconEntry));
                if (entry.bytesInResource == 0
                    || entry.imageOffset > icon.size()
                    || entry.bytesInResource
                        > icon.size() - entry.imageOffset) {
                    throw std::runtime_error("Invalid ICO image entry");
                }
                const std::uint16_t resourceId =
                    static_cast<std::uint16_t>(firstIconId + index);
                if (!UpdateResourceW(
                        update, MAKEINTRESOURCEW(3),
                        MAKEINTRESOURCEW(resourceId),
                        MAKELANGID(LANG_NEUTRAL, SUBLANG_NEUTRAL),
                        const_cast<std::uint8_t*>(
                            icon.data() + entry.imageOffset),
                        entry.bytesInResource)) {
                    throw std::runtime_error("Could not update RT_ICON");
                }
                const GroupIconEntry groupEntry{
                    entry.width,
                    entry.height,
                    entry.colorCount,
                    entry.reserved,
                    entry.planes,
                    entry.bitCount,
                    entry.bytesInResource,
                    resourceId,
                };
                writeStruct(
                    group,
                    sizeof(IconDirectory)
                        + static_cast<std::size_t>(index)
                            * sizeof(GroupIconEntry),
                    groupEntry);
            }
            if (!UpdateResourceW(
                    update, MAKEINTRESOURCEW(14), MAKEINTRESOURCEW(1),
                    MAKELANGID(LANG_NEUTRAL, SUBLANG_NEUTRAL), group.data(),
                    static_cast<DWORD>(group.size()))) {
                throw std::runtime_error("Could not update RT_GROUP_ICON");
            }
            if (!EndUpdateResourceW(update, FALSE)) {
                update = nullptr;
                throw std::runtime_error("EndUpdateResourceW failed");
            }
            update = nullptr;
            committed = true;
        } catch (...) {
            if (update != nullptr) {
                EndUpdateResourceW(update, TRUE);
            }
            throw;
        }
        if (!committed) {
            throw std::runtime_error("Icon resource was not committed");
        }
        return 0;
    } catch (const std::exception& error) {
        std::cerr << "KD Hybrid icon update failed: " << error.what() << '\n';
        return 1;
    }
}
