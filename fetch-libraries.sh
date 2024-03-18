VERSION=zeus-poc-1

ANDROID_FILE=Litdmobile.aar
IOS_FILE=Litdmobile.xcframework

ANDROID_SHA256='301211909f89a124bf8d2afc0353b8a0ef103ec5add6d752d5a694039c0bba91'
IOS_SHA256='f9ffc69b8664e893b3bb22d528576ff1c9b4bda1ca0ae5e71c9209e016dd727d'

FILE_PATH=https://github.com/ZeusLN/lightning-terminal/releases/download/$VERSION/

ANDROID_LINK=$FILE_PATH$ANDROID_FILE
IOS_LINK=$FILE_PATH$IOS_FILE.zip

# test that curl and unzip are installed
if ! command -v curl &> /dev/null
then
    echo "curl could not be found. Please install it and run the script again."
    exit
fi

if ! command -v unzip &> /dev/null
then
    echo "unzip could not be found. Please install it and run the script again."
    exit
fi

###########
# Android #
###########

if ! echo "$ANDROID_SHA256 android/litdmobile/$ANDROID_FILE" | sha256sum -c -; then
    echo "Android library file missing or checksum failed" >&2

    # delete old instance of library file
    rm android/litdmobile/$ANDROID_FILE

    # download Android LND library file
    curl -L $ANDROID_LINK > android/litdmobile/$ANDROID_FILE

    # check checksum
    if ! echo "$ANDROID_SHA256 android/litdmobile/$ANDROID_FILE" | sha256sum -c -; then
        echo "Android checksum failed" >&2
        exit 1
    fi
fi

#######
# iOS #
#######

mkdir ios/LitdMobileLibZipFile

if ! echo "$IOS_SHA256 ios/LitdMobileLibZipFile/$IOS_FILE.zip" | sha256sum -c -; then
    echo "iOS library file missing or checksum failed" >&2

    # delete old instance of library file
    rm ios/LitdMobileLibZipFile/$IOS_FILE.zip

    # download iOS LND library file
    curl -L $IOS_LINK > ios/LitdMobileLibZipFile/$IOS_FILE.zip

    # check checksum
    if ! echo "$IOS_SHA256 ios/LitdMobileLibZipFile/$IOS_FILE.zip" | sha256sum -c -; then
        echo "iOS checksum failed" >&2
        exit 1
    fi
fi

# delete old instances of library files
rm -rf ios/LncMobile/$IOS_FILE

# unzip LND library file
unzip ios/LitdMobileLibZipFile/$IOS_FILE.zip -d ios/LncMobile
