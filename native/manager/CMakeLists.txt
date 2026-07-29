cmake_minimum_required(VERSION 3.24)

project(KDHybridManager VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)

find_package(Qt6 6.2 REQUIRED COMPONENTS Core Widgets)

set(KD_REPOSITORY_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/../..")
set(KD_BOOTSTRAP_ROOT "${KD_REPOSITORY_ROOT}/dist/bootstrap")
set(KD_BOOTSTRAP_FILES
    "${KD_BOOTSTRAP_ROOT}/kd-hybrid-bootstrap.js"
    "${KD_BOOTSTRAP_ROOT}/kd-hybrid-bootstrap.js.map"
    "${KD_BOOTSTRAP_ROOT}/NOTICE.txt"
    "${KD_BOOTSTRAP_ROOT}/SOURCE.txt"
    "${KD_BOOTSTRAP_ROOT}/version.json"
    "${KD_BOOTSTRAP_ROOT}/LICENSES/MIT.txt"
    "${KD_BOOTSTRAP_ROOT}/LICENSES/MPL-2.0.txt"
    "${KD_BOOTSTRAP_ROOT}/source/MPL-2.0/crates/kd-core/src/pathfinding.rs"
    "${KD_BOOTSTRAP_ROOT}/source/MPL-2.0/packages/bootstrap/src/kd-adapters.ts"
    "${KD_BOOTSTRAP_ROOT}/source/MPL-2.0/packages/tools/src/kd-source-patches.ts"
    "${KD_BOOTSTRAP_ROOT}/source/MPL-2.0/packages/tools/src/kd-source-patch-v6.ts"
    "${KD_BOOTSTRAP_ROOT}/source/MPL-2.0/native/manager/src/SourcePatches.h"
    "${KD_BOOTSTRAP_ROOT}/source/MPL-2.0/native/manager/src/SourcePatches.cpp"
    "${KD_BOOTSTRAP_ROOT}/source/MPL-2.0/upstream-patches/kd-5.4.92/README.md"
    "${KD_BOOTSTRAP_ROOT}/source/MPL-2.0/upstream-patches/kd-5.4.92/source-optimizations-v6.patch"
    "${KD_BOOTSTRAP_ROOT}/source/MPL-2.0/upstream-patches/kd-5.4.92/bundle-optimizations-v6.patch"
    "${KD_BOOTSTRAP_ROOT}/wasm/kd_hybrid_core.js"
    "${KD_BOOTSTRAP_ROOT}/wasm/kd_hybrid_core_bg.wasm"
)

foreach(payload_file IN LISTS KD_BOOTSTRAP_FILES)
    if(NOT EXISTS "${payload_file}")
        message(FATAL_ERROR
            "Missing bootstrap payload ${payload_file}. Run npm run build first.")
    endif()
endforeach()

add_library(kd_manager_core
    src/Patcher.cpp
    src/Patcher.h
    src/SourcePatches.cpp
    src/SourcePatches.h
)
target_link_libraries(kd_manager_core PUBLIC Qt6::Core)
target_compile_definitions(kd_manager_core
    PUBLIC KD_MANAGER_VERSION="${PROJECT_VERSION}")
target_include_directories(kd_manager_core PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/src")

qt_add_resources(kd_manager_core "bootstrap_payload"
    PREFIX "/bootstrap"
    BASE "${KD_BOOTSTRAP_ROOT}"
    FILES ${KD_BOOTSTRAP_FILES}
)

add_executable(KDHybridManager WIN32
    src/main.cpp
    src/MainWindow.cpp
    src/MainWindow.h
)
target_link_libraries(KDHybridManager PRIVATE kd_manager_core Qt6::Widgets)
if(WIN32)
    target_sources(KDHybridManager PRIVATE assets/KDHybridManager.rc)
    target_link_libraries(KDHybridManager PRIVATE shell32)
    add_executable(KDHybridSetWindowsIcon tools/SetWindowsIcon.cpp)
    target_compile_features(KDHybridSetWindowsIcon PRIVATE cxx_std_20)
endif()

qt_add_resources(KDHybridManager "manager_icons"
    PREFIX "/icons"
    BASE "${CMAKE_CURRENT_SOURCE_DIR}/assets"
    FILES "${CMAKE_CURRENT_SOURCE_DIR}/assets/kd-hybrid-bandage.png"
)

if(MSVC)
    target_compile_options(kd_manager_core PRIVATE /W4 /permissive-)
    target_compile_options(KDHybridManager PRIVATE /W4 /permissive-)
    if(WIN32)
        target_compile_options(KDHybridSetWindowsIcon PRIVATE /W4 /permissive-)
    endif()
else()
    target_compile_options(kd_manager_core PRIVATE -Wall -Wextra -Wpedantic)
    target_compile_options(KDHybridManager PRIVATE -Wall -Wextra -Wpedantic)
endif()

include(CTest)
if(BUILD_TESTING)
    find_package(Qt6 6.2 REQUIRED COMPONENTS Test)
    add_executable(kd_manager_tests tests/PatcherTests.cpp)
    target_link_libraries(kd_manager_tests PRIVATE kd_manager_core Qt6::Test)
    add_test(NAME kd_manager_tests COMMAND kd_manager_tests)
endif()

install(TARGETS KDHybridManager
    RUNTIME DESTINATION .
    BUNDLE DESTINATION .
)
