#!/bin/bash


PID=$(pgrep -u dmdnode  diamond-node)
echo $PID 

if [[ -n "$PID" ]]; then
    echo "no running diamond node process found" 1>&2
    exit 1
fi


# GDB doesn't allow "thread apply all bt" when the process isn't
# threaded; need to peek at the process to determine if that or the
# simpler "bt" should be used.

backtrace="bt"
reg_trace="info all-registers"
if test -d /proc/$PID/task ; then
    # Newer kernel; has a task/ directory.
    if test `/bin/ls /proc/$PID/task | /usr/bin/wc -l` -gt 1 2>/dev/null ; then
        backtrace="thread apply all bt full"
	reg_trace="thread apply all info all-registers"
    fi
elif test -f /proc/$PID/maps ; then
    # Older kernel; go by it loading libpthread.
    if /bin/grep -e libpthread /proc/$PID/maps > /dev/null 2>&1 ; then
        backtrace="thread apply all bt full"
	reg_trace="thread apply all info all-registers"
    fi
fi

GDB=${GDB:-/usr/bin/gdb}
PMAP=${PMAP:-/usr/bin/pmap}

if $GDB -nx --quiet --batch --readnever > /dev/null 2>&1; then
    readnever=--readnever
else
    readnever=
fi

# Run GDB, strip out unwanted noise.
$GDB --quiet $readnever -nx /proc/$PID/exe $PID <<EOF 2>&1 |
$backtrace 
EOF
/bin/sed -n \
    -e 's/^(gdb) //' \
    -e '/^#/p' \
    -e '/^ /p' \
    -e '/^Thread/p'

# Run GDB, strip out unwanted noise.
$GDB --quiet $readnever -nx /proc/$PID/exe $PID <<EOF 2>&1 |
$reg_trace 
EOF
/bin/sed -n \
    -e 's/^(gdb) //' \
    -e '/^#/p' \
    -e '/^ /p' \
    -e '/^Thread/p'

$PMAP -d $PID