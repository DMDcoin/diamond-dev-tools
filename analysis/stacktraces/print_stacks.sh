

# if test $# -ne 1; then
#     echo "Usage: `basename $0 .sh` <process-id>" 1>&2
#     exit 1
# fi

# if test ! -r /proc/$1; then
#     echo "Process $1 not found." 1>&2
#     exit 1
# fi

PID=$(pgrep -u dmdnode  diamond-node)
echo $PID 

if [[ -n "$PID" ]]; then
    echo "no running diamond node process found" 1>&2
    exit 1
fi

sudo /usr/bin/gdb -x print_stacks.gdb --quiet --symbols /home/dmdnode/testnet/diamond-node-git/target/perf/diamond-node.d -nx /proc/$PID/exe $PID > stack_out.txt